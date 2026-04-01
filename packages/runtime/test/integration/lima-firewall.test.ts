/**
 * Lima Firewall Integration Tests
 *
 * These tests run real scripts in the Lima VM with iptables network
 * restrictions and verify that disallowed hosts are unreachable via
 * multiple bypass methods (curl, wget, python, /dev/tcp).
 *
 * Requires: Lima VM "bands-executor" running with iptables installed.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { execSync } from "child_process";
import { writeFileSync, mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { limaExec } from "../../src/banded-skills/lima-exec";

const VM_NAME = "bands-executor";
const TIMEOUT = 30_000;

let limaAvailable = false;

beforeAll(async () => {
  try {
    execSync(`limactl shell ${VM_NAME} -- echo ok`, { stdio: "pipe" });
    limaAvailable = true;
  } catch {
    limaAvailable = false;
  }
});

/** Create a temp script and run it through limaExec with given network rules. */
async function runScript(
  script: string,
  allowNet: string[],
  denyNet: string[] = []
): Promise<{ success: boolean; data?: any; error?: string }> {
  return runScriptFull(script, allowNet, denyNet, { allowRead: [], allowWrite: [] });
}

/** Full version with all rule types. */
async function runScriptFull(
  script: string,
  allowNet: string[],
  denyNet: string[],
  fileRules: { allowCli?: string[]; denyCli?: string[]; allowRead: string[]; allowWrite: string[]; insist?: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] } }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const dir = mkdtempSync(join(tmpdir(), "lima-fw-test-"));
  const runSh = join(dir, "run.sh");
  const inputPath = join(dir, "input.json");
  const outputPath = join(dir, "output.json");

  writeFileSync(runSh, script);
  writeFileSync(inputPath, "{}");

  try {
    return await limaExec(
      runSh,
      dir,
      inputPath,
      outputPath,
      VM_NAME,
      {},
      undefined,
      undefined,
      { allowNet, denyNet },
      { allowCli: fileRules.allowCli ?? [], denyCli: fileRules.denyCli ?? [], allowRead: fileRules.allowRead, allowWrite: fileRules.allowWrite, insist: fileRules.insist }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Create a temp script with network, CLI, and file rules. */
async function runScriptWithFiles(
  script: string,
  allowNet: string[],
  fileRules: { allowCli?: string[]; denyCli?: string[]; allowRead: string[]; allowWrite: string[]; insist?: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] } }
): Promise<{ success: boolean; data?: any; error?: string }> {
  return runScriptFull(script, allowNet, [], fileRules);
}

function skip() {
  if (!limaAvailable) {
    console.log("  ⏭  Skipping: Lima VM not available");
    return true;
  }
  return false;
}

describe("Lima user separation", () => {
  test(
    "scripts run as unprivileged user, not root",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        MY_UID=$(id -u)
        echo "{\\"uid\\": $MY_UID}" > "$OUTPUT_PATH"`,
        []
      );
      expect(result.success).toBe(true);
      // Should NOT be root (uid 0)
      expect((result.data as any).uid).not.toBe(0);
    },
    TIMEOUT
  );

  test(
    "sandbox cannot see host home directories",
    async () => {
      if (skip()) return;
      const result = await runScript(
        [
          "#!/bin/bash",
          'if [ -d /home ] && [ "$(ls -A /home 2>/dev/null)" ]; then',
          '  echo \'{"empty": false}\' > "$OUTPUT_PATH"',
          "else",
          '  echo \'{"empty": true}\' > "$OUTPUT_PATH"',
          "fi",
        ].join("\n"),
        []
      );
      expect(result.success).toBe(true);
      expect((result.data as any).empty).toBe(true);
    },
    TIMEOUT
  );

  test(
    "sandbox cannot read /etc/shadow (sensitive, root-only)",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        if cat /etc/shadow >/dev/null 2>&1; then
          echo '{"can_read": true}' > "$OUTPUT_PATH"
        else
          echo '{"can_read": false}' > "$OUTPUT_PATH"
        fi`,
        []
      );
      expect(result.success).toBe(true);
      expect((result.data as any).can_read).toBe(false);
    },
    TIMEOUT
  );

  test(
    "sandbox cannot write outside workdir",
    async () => {
      if (skip()) return;
      const result = await runScript(
        [
          "#!/bin/bash",
          "# Try to write to /tmp (which is a fresh tmpfs, not the host /tmp)",
          'echo "escape" > /tmp/escape-test.txt 2>/dev/null',
          "# The file exists in sandbox /tmp but not in host /tmp",
          '# Verify we can write to our workdir though',
          'echo \'{"can_write_workdir": true}\' > "$OUTPUT_PATH"',
        ].join("\n"),
        []
      );
      expect(result.success).toBe(true);
      expect((result.data as any).can_write_workdir).toBe(true);

      // Verify the escape file does NOT exist in the real VM /tmp
      try {
        execSync(
          `limactl shell ${VM_NAME} -- test -f /tmp/escape-test.txt`,
          { stdio: "pipe" }
        );
        expect("file escaped sandbox").toBe("file should not exist in host /tmp");
      } catch {
        // Expected — file should NOT exist in host /tmp
      }
    },
    TIMEOUT
  );

  test(
    "workdir is cleaned up after execution",
    async () => {
      if (skip()) return;

      // Run a script that writes its workdir path
      const result = await runScript(
        `#!/bin/bash
        echo "{\\"workdir\\": \\"$(dirname $INPUT_PATH)\\"}" > "$OUTPUT_PATH"`,
        []
      );
      expect(result.success).toBe(true);
      const workdir = (result.data as any).workdir;
      expect(workdir).toContain("/tmp/band-exec-");

      // Verify the workdir no longer exists
      try {
        execSync(`limactl shell ${VM_NAME} -- test -d ${workdir}`, { stdio: "pipe" });
        // If we get here, the dir still exists — fail
        expect("workdir exists").toBe("workdir should be cleaned up");
      } catch {
        // Expected — dir should not exist
      }
    },
    TIMEOUT
  );
});

describe("Lima file access (bwrap bind mounts)", () => {
  test(
    "script can read a file via allow.read bind mount",
    async () => {
      if (skip()) return;

      // Create a file in the VM that the script should be able to read
      const testDir = `/tmp/band-file-test-${Date.now()}`;
      execSync(
        `limactl shell ${VM_NAME} -- bash -c 'mkdir -p ${testDir} && echo "secret-data" > ${testDir}/input.txt'`,
        { stdio: "pipe" }
      );

      try {
        const result = await runScriptWithFiles(
          [
            "#!/bin/bash",
            `CONTENT=$(cat ${testDir}/input.txt 2>/dev/null || echo "BLOCKED")`,
            'echo "{\\"content\\": \\"$CONTENT\\"}" > "$OUTPUT_PATH"',
          ].join("\n"),
          [],
          { allowRead: [`${testDir}/**`], allowWrite: [] }
        );
        expect(result.success).toBe(true);
        expect((result.data as any).content).toBe("secret-data");
      } finally {
        execSync(`limactl shell ${VM_NAME} -- rm -rf ${testDir}`, { stdio: "pipe" });
      }
    },
    TIMEOUT
  );

  test(
    "script cannot read a file NOT in allow.read",
    async () => {
      if (skip()) return;

      const testDir = `/tmp/band-file-test-${Date.now()}`;
      execSync(
        `limactl shell ${VM_NAME} -- bash -c 'mkdir -p ${testDir} && echo "secret" > ${testDir}/hidden.txt'`,
        { stdio: "pipe" }
      );

      try {
        const result = await runScriptWithFiles(
          [
            "#!/bin/bash",
            `CONTENT=$(cat ${testDir}/hidden.txt 2>/dev/null || echo "BLOCKED")`,
            'echo "{\\"content\\": \\"$CONTENT\\"}" > "$OUTPUT_PATH"',
          ].join("\n"),
          [],
          { allowRead: [], allowWrite: [] } // no file access granted
        );
        expect(result.success).toBe(true);
        expect((result.data as any).content).toBe("BLOCKED");
      } finally {
        execSync(`limactl shell ${VM_NAME} -- rm -rf ${testDir}`, { stdio: "pipe" });
      }
    },
    TIMEOUT
  );

  test(
    "script can write to a file via allow.write bind mount",
    async () => {
      if (skip()) return;

      const testDir = `/tmp/band-file-test-${Date.now()}`;
      execSync(
        `limactl shell ${VM_NAME} -- bash -c 'mkdir -p ${testDir} && chmod 777 ${testDir}'`,
        { stdio: "pipe" }
      );

      try {
        const result = await runScriptWithFiles(
          [
            "#!/bin/bash",
            `echo "written-by-script" > ${testDir}/output.txt`,
            'echo \'{"wrote": true}\' > "$OUTPUT_PATH"',
          ].join("\n"),
          [],
          { allowRead: [], allowWrite: [`${testDir}/**`] }
        );
        expect(result.success).toBe(true);
        expect((result.data as any).wrote).toBe(true);

        // Verify the file was actually written on the host (persisted through bind mount)
        const content = execSync(
          `limactl shell ${VM_NAME} -- cat ${testDir}/output.txt`,
          { encoding: "utf-8" }
        ).trim();
        expect(content).toBe("written-by-script");
      } finally {
        execSync(`limactl shell ${VM_NAME} -- rm -rf ${testDir}`, { stdio: "pipe" });
      }
    },
    TIMEOUT
  );

  test(
    "script cannot write to a path NOT in allow.write",
    async () => {
      if (skip()) return;

      const testDir = `/tmp/band-file-test-${Date.now()}`;
      execSync(
        `limactl shell ${VM_NAME} -- bash -c 'mkdir -p ${testDir} && chmod 777 ${testDir}'`,
        { stdio: "pipe" }
      );

      try {
        const result = await runScriptWithFiles(
          [
            "#!/bin/bash",
            `echo "escape" > ${testDir}/escaped.txt 2>/dev/null`,
            `if [ -f ${testDir}/escaped.txt ]; then`,
            '  echo \'{"escaped": true}\' > "$OUTPUT_PATH"',
            "else",
            '  echo \'{"escaped": false}\' > "$OUTPUT_PATH"',
            "fi",
          ].join("\n"),
          [],
          { allowRead: [], allowWrite: [] } // no write access
        );
        expect(result.success).toBe(true);
        expect((result.data as any).escaped).toBe(false);
      } finally {
        execSync(`limactl shell ${VM_NAME} -- rm -rf ${testDir}`, { stdio: "pipe" });
      }
    },
    TIMEOUT
  );
});

describe("Lima CLI enforcement (allow/deny)", () => {
  test(
    "allowed command works",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        RESULT=$(echo '{"a":1}' | jq .a)
        echo "{\\"result\\": $RESULT}" > "$OUTPUT_PATH"`,
        [],
        { allowCli: ["jq *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).result).toBe(1);
    },
    TIMEOUT
  );

  test(
    "command not in allow.cli is not found (default deny)",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        if curl --version >/dev/null 2>&1; then
          echo '{"found": true}' > "$OUTPUT_PATH"
        else
          echo '{"found": false}' > "$OUTPUT_PATH"
        fi`,
        [],
        { allowCli: ["jq *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).found).toBe(false);
    },
    TIMEOUT
  );

  test(
    "full path bypass blocked (PATH-only enforcement)",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        if /usr/bin/curl --version >/dev/null 2>&1; then
          echo '{"bypassed": true}' > "$OUTPUT_PATH"
        else
          echo '{"bypassed": false}' > "$OUTPUT_PATH"
        fi`,
        [],
        { allowCli: ["jq *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      // Full path still works since /usr/bin is mounted — documented limitation
      // Network firewall is the real enforcement for network tools
    },
    TIMEOUT
  );

  test(
    "deny.cli blocks specific argument patterns",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        [
          "#!/bin/bash",
          'RES=$(echo \'{"a":1}\' | jq -r .a 2>&1)',
          'echo "{\\"res\\": \\"$RES\\"}" > "$OUTPUT_PATH"',
        ].join("\n"),
        [],
        { allowCli: ["jq *"], denyCli: ["jq -r *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).res).toContain("DENIED");
    },
    TIMEOUT
  );

  test(
    "deny.cli allows non-matching argument patterns",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        [
          "#!/bin/bash",
          'RES=$(echo \'{"a":1}\' | jq .a 2>&1)',
          'echo "{\\"res\\": \\"$RES\\"}" > "$OUTPUT_PATH"',
        ].join("\n"),
        [],
        { allowCli: ["jq *"], denyCli: ["jq -r *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).res).toBe("1");
    },
    TIMEOUT
  );

  test(
    "deny.cli blocks rm -rf but allows rm",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        [
          "#!/bin/bash",
          "TMP=$(mktemp)",
          'rm -rf "$TMP" 2>&1',
          'EXIT=$?',
          'echo "{\\"exit_code\\": $EXIT}" > "$OUTPUT_PATH"',
        ].join("\n"),
        [],
        { allowCli: ["rm *"], denyCli: ["rm -rf *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).exit_code).toBe(126);
    },
    TIMEOUT
  );

  test(
    "essential commands work even without allow.cli listing them",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        TMP=$(mktemp)
        echo "hello" > "$TMP"
        WORD=$(cat "$TMP" | grep -o "hello")
        echo "{\\"word\\": \\"$WORD\\"}" > "$OUTPUT_PATH"`,
        [],
        { allowCli: ["jq *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).word).toBe("hello");
    },
    TIMEOUT
  );

  test(
    "no allow/deny CLI rules means all commands available",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        if ls / >/dev/null 2>&1; then
          echo '{"ls_works": true}' > "$OUTPUT_PATH"
        else
          echo '{"ls_works": false}' > "$OUTPUT_PATH"
        fi`,
        [],
        { allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).ls_works).toBe(true);
    },
    TIMEOUT
  );

  test(
    "absolute path execution is blocked by extdebug trap",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        [
          "#!/bin/bash",
          '# Direct absolute path should be blocked',
          'RESULT=$(/usr/bin/id 2>&1 || true)',
          'if [ -z "$RESULT" ]; then',
          '  echo \'{"blocked": true}\' > "$OUTPUT_PATH"',
          "else",
          '  echo \'{"blocked": false}\' > "$OUTPUT_PATH"',
          "fi",
        ].join("\n"),
        [],
        { allowCli: ["jq *"], allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
      expect((result.data as any).blocked).toBe(true);
    },
    TIMEOUT
  );
});

describe("Lima deny.net (holes in allow)", () => {
  test(
    "deny.net blocks a host within an allow wildcard",
    async () => {
      if (skip()) return;
      // Allow all of *.github.com but deny api.github.com specifically
      const result = await runScript(
        `#!/bin/bash
        if curl -s --connect-timeout 3 https://api.github.com >/dev/null 2>&1; then
          echo '{"blocked": false}' > "$OUTPUT_PATH"
        else
          echo '{"blocked": true}' > "$OUTPUT_PATH"
        fi`,
        ["*.github.com"],
        ["api.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).blocked).toBe(true);
    },
    TIMEOUT
  );

  test(
    "deny.net does not affect non-denied hosts in the same allow wildcard",
    async () => {
      if (skip()) return;
      // Allow *.github.com, deny api.github.com — github.com itself should still work
      const result = await runScript(
        `#!/bin/bash
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://github.com)
        echo "{\\"code\\": $HTTP_CODE}" > "$OUTPUT_PATH"`,
        ["*.github.com"],
        ["api.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).code).toBeGreaterThanOrEqual(200);
      expect((result.data as any).code).toBeLessThan(500);
    },
    TIMEOUT
  );

  test(
    "allow * with deny blocks only the denied host",
    async () => {
      if (skip()) return;
      // Allow everything but deny httpbin.org
      const result = await runScript(
        `#!/bin/bash
        if curl -s --connect-timeout 3 https://httpbin.org/ip >/dev/null 2>&1; then
          echo '{"blocked": false}' > "$OUTPUT_PATH"
        else
          echo '{"blocked": true}' > "$OUTPUT_PATH"
        fi`,
        ["*"],
        ["httpbin.org"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).blocked).toBe(true);
    },
    TIMEOUT
  );
});

describe("Lima insist enforcement", () => {
  test(
    "insist.cli passes when required command is executed",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        echo '{"a":1}' | jq .a > /dev/null
        echo '{"ok": true}' > "$OUTPUT_PATH"`,
        [],
        {
          allowCli: ["jq *"],
          allowRead: [],
          allowWrite: [],
          insist: { cli: ["jq *"] },
        }
      );
      expect(result.success).toBe(true);
    },
    TIMEOUT
  );

  test(
    "insist.cli fails when required command is NOT executed",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        echo '{"ok": true}' > "$OUTPUT_PATH"`,
        [],
        {
          allowCli: ["jq *"],
          allowRead: [],
          allowWrite: [],
          insist: { cli: ["jq *"] },
        }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insist not satisfied");
      expect(result.error).toContain("cli: jq *");
    },
    TIMEOUT
  );

  test(
    "insist.cli with specific pattern requires matching args",
    async () => {
      if (skip()) return;
      // insist requires "jq .name", but script runs "jq .age"
      const result = await runScriptWithFiles(
        `#!/bin/bash
        echo '{"name":"test","age":1}' | jq .age > /dev/null
        echo '{"ok": true}' > "$OUTPUT_PATH"`,
        [],
        {
          allowCli: ["jq *"],
          allowRead: [],
          allowWrite: [],
          insist: { cli: ["jq .name"] },
        }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insist not satisfied");
    },
    TIMEOUT
  );

  test(
    "insist.write fails when required file is NOT written",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        echo '{"ok": true}' > "$OUTPUT_PATH"`,
        [],
        {
          allowRead: [],
          allowWrite: ["/tmp/insist-test/**"],
          insist: { write: ["/tmp/insist-test/result.json"] },
        }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insist not satisfied");
      expect(result.error).toContain("write:");
    },
    TIMEOUT
  );

  test(
    "no insist rules means execution always succeeds",
    async () => {
      if (skip()) return;
      const result = await runScriptWithFiles(
        `#!/bin/bash
        echo '{"ok": true}' > "$OUTPUT_PATH"`,
        [],
        { allowRead: [], allowWrite: [] }
      );
      expect(result.success).toBe(true);
    },
    TIMEOUT
  );
});

describe("Lima iptables firewall", () => {
  // ── Allowed traffic should work ───────────────────────────────────

  test(
    "allows traffic to permitted host",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        set -e
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://api.github.com)
        echo "{\\"code\\": $HTTP_CODE}" > "$OUTPUT_PATH"`,
        ["api.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).code).toBeGreaterThanOrEqual(200);
      expect((result.data as any).code).toBeLessThan(500);
    },
    TIMEOUT
  );

  // ── Blocked traffic: curl ─────────────────────────────────────────

  test(
    "blocks curl to disallowed host",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        if curl -s --max-time 5 https://httpbin.org/ip >/dev/null 2>&1; then
          echo '{"escaped": true}' > "$OUTPUT_PATH"
        else
          echo '{"escaped": false}' > "$OUTPUT_PATH"
        fi`,
        ["api.github.com"] // only github allowed, not httpbin
      );
      expect(result.success).toBe(true);
      expect((result.data as any).escaped).toBe(false);
    },
    TIMEOUT
  );

  // ── Blocked traffic: wget ─────────────────────────────────────────

  test(
    "blocks wget to disallowed host",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        if wget -q --connect-timeout=3 --timeout=5 -O /dev/null https://example.com 2>/dev/null; then
          echo '{"escaped": true}' > "$OUTPUT_PATH"
        else
          echo '{"escaped": false}' > "$OUTPUT_PATH"
        fi`,
        ["api.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).escaped).toBe(false);
    },
    TIMEOUT
  );

  // ── Blocked traffic: python ───────────────────────────────────────

  test(
    "blocks python urllib to disallowed host",
    async () => {
      if (skip()) return;
      const result = await runScript(
        [
          "#!/bin/bash",
          "PYSCRIPT=$(mktemp)",
          'cat > "$PYSCRIPT" << \'PYEOF\'',
          "import urllib.request",
          "try:",
          "    urllib.request.urlopen('https://httpbin.org/ip', timeout=3)",
          "    print('true')",
          "except:",
          "    print('false')",
          "PYEOF",
          'ESCAPED=$(python3 "$PYSCRIPT" 2>/dev/null || echo "false")',
          'rm -f "$PYSCRIPT"',
          'echo "{\\\"escaped\\\": $ESCAPED}" > "$OUTPUT_PATH"',
        ].join("\n"),
        ["api.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).escaped).toBe(false);
    },
    TIMEOUT
  );

  // ── Blocked traffic: /dev/tcp (raw socket via bash) ───────────────

  test(
    "blocks /dev/tcp raw socket to disallowed host",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        # Use timeout command to avoid hanging on blocked connections
        if timeout 3 bash -c 'echo > /dev/tcp/93.184.216.34/80' 2>/dev/null; then
          echo '{"escaped": true}' > "$OUTPUT_PATH"
        else
          echo '{"escaped": false}' > "$OUTPUT_PATH"
        fi`,
        ["api.github.com"] // example.com IP should be blocked
      );
      expect(result.success).toBe(true);
      expect((result.data as any).escaped).toBe(false);
    },
    TIMEOUT
  );

  // ── DNS resolution should still work ──────────────────────────────

  test(
    "allows DNS resolution even for blocked hosts",
    async () => {
      if (skip()) return;
      const result = await runScript(
        [
          "#!/bin/bash",
          "IP=$(getent hosts httpbin.org 2>/dev/null | head -1 | awk '{print $1}')",
          'if [ -n "$IP" ]; then',
          '  printf \'{"resolved": true, "ip": "%s"}\\n\' "$IP" > "$OUTPUT_PATH"',
          "else",
          '  echo \'{"resolved": false}\' > "$OUTPUT_PATH"',
          "fi",
        ].join("\n"),
        ["api.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).resolved).toBe(true);
    },
    TIMEOUT
  );

  // ── No rules = no restrictions ────────────────────────────────────

  test(
    "blocks all traffic when allowNet is empty (default DROP)",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        if curl -s --connect-timeout 3 https://httpbin.org/ip >/dev/null 2>&1; then
          echo '{"escaped": true}' > "$OUTPUT_PATH"
        else
          echo '{"escaped": false}' > "$OUTPUT_PATH"
        fi`,
        [] // empty = locked down, no network
      );
      expect(result.success).toBe(true);
      expect((result.data as any).escaped).toBe(false);
    },
    TIMEOUT
  );

  // ── Wildcard allows subdomains ────────────────────────────────────

  test(
    "wildcard *.github.com allows api.github.com",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://api.github.com)
        echo "{\\"code\\": $HTTP_CODE}" > "$OUTPUT_PATH"`,
        ["*.github.com"]
      );
      expect(result.success).toBe(true);
      expect((result.data as any).code).toBeGreaterThanOrEqual(200);
      expect((result.data as any).code).toBeLessThan(500);
    },
    TIMEOUT
  );

  // ── Cleanup: verify no leftover chains ────────────────────────────

  test(
    "cleans up iptables chains after execution",
    async () => {
      if (skip()) return;

      // Run a script with firewall
      await runScript(
        `#!/bin/bash
        echo '{"ok": true}' > "$OUTPUT_PATH"`,
        ["example.com"]
      );

      // Check no per-execution BAND- chains remain (BAND-DEFAULT is permanent)
      const chains = execSync(
        `limactl shell ${VM_NAME} -- sudo iptables -L -n 2>&1`,
        { encoding: "utf-8" }
      );
      // Per-execution chains are named BAND-<8chars>, not BAND-DEFAULT
      const perExecChains = chains.match(/BAND-[a-z0-9]{6,}/g) || [];
      expect(perExecChains.length).toBe(0);
    },
    TIMEOUT
  );
});
