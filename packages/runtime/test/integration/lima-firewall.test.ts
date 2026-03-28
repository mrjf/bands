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
  allowNet: string[]
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
      { allowNet, denyNet: [] }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function skip() {
  if (!limaAvailable) {
    console.log("  ⏭  Skipping: Lima VM not available");
    return true;
  }
  return false;
}

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
    "allows all traffic when allowNet is empty (no firewall)",
    async () => {
      if (skip()) return;
      const result = await runScript(
        `#!/bin/bash
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://httpbin.org/ip)
        echo "{\\"code\\": $HTTP_CODE}" > "$OUTPUT_PATH"`,
        [] // empty = no restrictions
      );
      expect(result.success).toBe(true);
      expect((result.data as any).code).toBe(200);
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

      // Check no BAND- chains remain
      const chains = execSync(
        `limactl shell ${VM_NAME} -- sudo iptables -L -n 2>&1`,
        { encoding: "utf-8" }
      );
      expect(chains).not.toContain("BAND-");
    },
    TIMEOUT
  );
});
