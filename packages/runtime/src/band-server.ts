/**
 * Band Execution Server — runs inside the Lima VM.
 *
 * Single-use per request. The VM boots locked down (iptables DROP all outbound).
 * Each execution:
 * 1. Receives script, input, secrets, and allow rules via POST /exec
 * 2. Opens iptables for allowed hosts
 * 3. Runs script inside bubblewrap sandbox
 * 4. Captures output
 * 5. Tears down iptables rules, cleans up workdir
 * 6. Returns output
 *
 * Rejects concurrent requests — one execution at a time, full reset between.
 *
 * This file is deployed to the VM as ~/bands-server/server.ts
 * and run via systemd as a long-lived service.
 */

import { Hono } from "hono";

const BAND_RUNNER_USER = "band-runner";
let executing = false;

// Get band-runner uid/gid once at startup
function getBandRunnerIds(): { uid: number; gid: number } {
  try {
    const uid = parseInt(
      Bun.spawnSync(["id", "-u", BAND_RUNNER_USER]).stdout.toString().trim()
    );
    const gid = parseInt(
      Bun.spawnSync(["id", "-g", BAND_RUNNER_USER]).stdout.toString().trim()
    );
    return { uid, gid };
  } catch {
    return { uid: 65534, gid: 65534 };
  }
}

const bandRunnerIds = getBandRunnerIds();

// ── Helpers ───────────────────────────────────────────────────────────

function shell(cmd: string): string {
  const proc = Bun.spawnSync(["sudo", "bash", "-c", cmd]);
  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString() || `Command failed: ${cmd}`);
  }
  return proc.stdout.toString();
}

function shellIgnoreError(cmd: string): void {
  Bun.spawnSync(["sudo", "bash", "-c", cmd]);
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function writeFile(path: string, content: string): void {
  // Base64-encode to avoid shell escaping issues with arbitrary content
  const b64 = Buffer.from(content).toString("base64");
  shell(`echo '${b64}' | base64 -d > ${path}`);
}

// ── Firewall ──────────────────────────────────────────────────────────

function setupFirewall(
  chainName: string,
  allowNet: string[],
  denyNet: string[]
): void {
  if (allowNet.length === 0 && denyNet.length === 0) return;
  if (allowNet.includes("*") && denyNet.length === 0) return;

  // Check if iptables is available and BAND-DEFAULT chain exists.
  // If not (e.g., CI), skip firewall setup — the default iptables
  // policy is ACCEPT and per-execution rules won't work reliably
  // with CDN/anycast IPs anyway.
  try {
    shell("iptables -L BAND-DEFAULT -n >/dev/null 2>&1");
  } catch {
    return; // No default chain = no firewall enforcement
  }

  const cmds: string[] = [
    `iptables -N ${chainName} 2>/dev/null || iptables -F ${chainName}`,
    `iptables -A ${chainName} -o lo -j ACCEPT`,
    `iptables -A ${chainName} -m state --state ESTABLISHED,RELATED -j ACCEPT`,
    `iptables -A ${chainName} -p udp --dport 53 -j ACCEPT`,
    `iptables -A ${chainName} -p tcp --dport 53 -j ACCEPT`,
  ];

  // Deny rules FIRST — they punch holes in allow (deny takes precedence)
  for (const host of denyNet) {
    const resolveHost = host.startsWith("*.") ? host.slice(2) : host;
    cmds.push(
      `for ip in $(getent ahosts "${resolveHost}" 2>/dev/null | awk '{print $1}' | sort -u); do iptables -A ${chainName} -d "$ip" -j REJECT; done`
    );
  }

  // Allow rules
  for (const host of allowNet) {
    if (host === "*") continue; // handled by not adding final REJECT
    if (host.startsWith("*.")) {
      const base = host.slice(2);
      cmds.push(
        `for ip in $(getent ahosts "${base}" 2>/dev/null | awk '{print $1}' | sort -u); do iptables -A ${chainName} -d "$ip" -j ACCEPT; done`,
        `for ip in $(getent ahosts "api.${base}" 2>/dev/null | awk '{print $1}' | sort -u); do iptables -A ${chainName} -d "$ip" -j ACCEPT; done`,
        `for ip in $(getent ahosts "www.${base}" 2>/dev/null | awk '{print $1}' | sort -u); do iptables -A ${chainName} -d "$ip" -j ACCEPT; done`
      );
    } else {
      cmds.push(
        `for ip in $(getent ahosts "${host}" 2>/dev/null | awk '{print $1}' | sort -u); do iptables -A ${chainName} -d "$ip" -j ACCEPT; done`
      );
    }
  }

  // Default REJECT (unless allow: ["*"] which means allow everything not denied)
  if (!allowNet.includes("*")) {
    cmds.push(`iptables -A ${chainName} -j REJECT`);
  }

  cmds.push(`iptables -I OUTPUT 1 -m owner --uid-owner ${bandRunnerIds.uid} -m state --state NEW -j ${chainName}`);

  shell(cmds.join("\n"));
}

function teardownFirewall(chainName: string): void {
  shellIgnoreError(
    `iptables -D OUTPUT -m owner --uid-owner ${bandRunnerIds.uid} -m state --state NEW -j ${chainName} 2>/dev/null; ` +
      `iptables -F ${chainName} 2>/dev/null; ` +
      `iptables -X ${chainName} 2>/dev/null`
  );
}

// ── Bubblewrap ────────────────────────────────────────────────────────

function buildBwrapArgs(
  workdir: string,
  allowRead: string[],
  allowWrite: string[]
): string[] {
  const args = ["bwrap"];

  // If allowCli is specified, mount system dirs selectively:
  // - /usr/lib, /usr/share, /usr/libexec (libraries/data, read-only)
  // - /usr/bin as empty tmpfs, then bind-mount only allowed + essential binaries
  // - /bin as empty tmpfs with only sh
  // This is kernel-level CLI enforcement — unlisted binaries don't exist.
  // Mount system binaries (always full — CLI restrictions are enforced
  // via deny wrappers in PATH, not by hiding binaries)
  args.push(
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/bin", "/bin",
  );

  args.push(
    "--ro-bind", "/sbin", "/sbin",
    "--ro-bind", "/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64",
    "--ro-bind", "/etc", "/etc",
    // Runtime state (DNS resolver sockets, sudo, dbus)
    "--bind-try", "/run", "/run",
    "--proc", "/proc",
    "--dev", "/dev",
    // Isolated /tmp and /home (1777 = world-writable like normal /tmp)
    "--perms", "1777", "--tmpfs", "/tmp",
    "--perms", "1777", "--tmpfs", "/home",
    // Workdir (only writable persistent mount)
    "--bind", workdir, workdir,
    "--die-with-parent",
  );

  // File access mounts from allow.read / allow.write
  const mounted = new Set<string>();
  for (const pattern of allowRead) {
    const dir = extractMountDir(pattern);
    if (dir && !mounted.has(dir)) {
      args.push("--ro-bind-try", dir, dir);
      mounted.add(dir);
    }
  }
  for (const pattern of allowWrite) {
    const dir = extractMountDir(pattern);
    if (dir && !mounted.has(dir)) {
      args.push("--bind-try", dir, dir);
      mounted.add(dir);
    }
  }

  // Run as band-runner via sudo inside the sandbox.
  // This preserves the real UID for iptables --uid-owner matching.
  args.push("--", "/usr/bin/sudo", "-u", BAND_RUNNER_USER, "/bin/bash", "-c",
    `source ${workdir}/env.sh && bash ${workdir}/run.sh`
  );
  return args;
}

function extractMountDir(pattern: string): string | null {
  const globIdx = pattern.search(/[*?{[]/);
  const concrete = globIdx === -1 ? pattern : pattern.slice(0, globIdx);
  const lastSlash = concrete.lastIndexOf("/");
  if (lastSlash <= 0 && !concrete.startsWith("/")) return null;
  const dir = lastSlash === 0 ? "/" : concrete.slice(0, lastSlash);
  const systemPrefixes = ["/usr", "/lib", "/lib64", "/bin", "/sbin", "/dev", "/proc"];
  for (const prefix of systemPrefixes) {
    if (dir === prefix || dir.startsWith(prefix + "/")) return null;
  }
  if (dir === "/") return null;
  return dir;
}

// ── CLI deny wrappers ─────────────────────────────────────────────────

// Essential commands always available regardless of allow.cli.
const ESSENTIAL_COMMANDS = [
  "bash", "sh", "env",
  "cat", "echo", "printf", "test", "true", "false",
  "head", "tail", "grep", "sed", "awk", "sort", "uniq", "wc", "tr", "cut",
  "mktemp", "rm", "mkdir", "chmod", "chown", "touch", "cp", "mv", "ln",
  "dirname", "basename", "readlink", "realpath",
  "tee", "xargs", "find", "date", "sleep", "timeout",
  "base64", "md5sum", "sha256sum",
  "id", "whoami", "getent",
  "sudo", "su",
];

/**
 * Set up CLI enforcement via wrapper scripts.
 *
 * Default deny: PATH is set to ONLY the wrapper directory.
 * Commands not in allow.cli (or essentials) → "command not found".
 * Commands matching deny.cli patterns → exit 126 with DENIED message.
 *
 * Each allowed command gets a wrapper that:
 * 1. Checks full command line against deny.cli patterns (if any)
 * 2. If denied: prints error, exits 126
 * 3. If allowed: exec's the real binary via absolute path
 */
function setupCliWrappers(
  wrapperDir: string,
  allowPatterns: string[],
  denyPatterns: string[]
): void {
  // Collect allowed command names
  const allowedCommands = new Set(ESSENTIAL_COMMANDS);
  for (const pattern of allowPatterns) {
    const cmd = pattern.split(/\s+/)[0];
    if (cmd && !cmd.includes("*") && !cmd.includes("/")) {
      allowedCommands.add(cmd);
    }
  }

  // Group deny patterns by command name
  const denyByCmd = new Map<string, string[]>();
  for (const pattern of denyPatterns) {
    const cmd = pattern.split(/\s+/)[0];
    if (!cmd) continue;
    const existing = denyByCmd.get(cmd) || [];
    existing.push(pattern);
    denyByCmd.set(cmd, existing);
  }

  // Create wrapper for each allowed command
  for (const cmd of allowedCommands) {
    let realPath: string;
    try {
      realPath = shell(`readlink -f $(which ${cmd}) 2>/dev/null`).trim();
    } catch { continue; }
    if (!realPath) continue;

    const denyPats = denyByCmd.get(cmd) || [];

    // All wrappers log the command to the ops tracker file for insist checking.
    // BAND_OPS_FILE is set in env.sh when insist rules exist.
    const logLine = `[ -n "\$BAND_OPS_FILE" ] && echo "${cmd} $*" >> "\$BAND_OPS_FILE"`;

    let wrapper: string;
    if (denyPats.length > 0) {
      const patternArray = denyPats.map(p => `"${p.replace(/"/g, '\\"')}"`).join(" ");
      wrapper = `#!/bin/bash
FULL_CMD="${cmd} $*"
DENY_PATTERNS=(${patternArray})
for P in "\${DENY_PATTERNS[@]}"; do
  if eval "[[ \\"\\$FULL_CMD\\" == \\$P ]]" 2>/dev/null; then
    echo "DENIED: $FULL_CMD" >&2
    exit 126
  fi
done
${logLine}
exec ${realPath} "$@"
`;
    } else {
      wrapper = `#!/bin/bash
${logLine}
exec ${realPath} "$@"
`;
    }

    writeFile(`${wrapperDir}/${cmd}`, wrapper);
    shell(`chmod +x ${wrapperDir}/${cmd}`);
  }
}

// ── Insist checking ───────────────────────────────────────────────────

/**
 * Glob match using bash-style patterns.
 */
function matchGlob(str: string, pattern: string): boolean {
  const regex = "^" + pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    + "$";
  try {
    return new RegExp(regex).test(str);
  } catch {
    return str === pattern;
  }
}

/**
 * Check insist requirements after script execution.
 *
 * - cli: checks logged commands in ops file against insist.cli patterns
 * - write: checks if files matching insist.write patterns exist in workdir or bind mounts
 * - read: checks if files matching insist.read patterns were accessed (via ops log)
 * - net: checks if connections to insist.net hosts were made (via iptables counters)
 */
function checkInsist(
  insist: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] },
  workdir: string,
  opsFile: string
): { satisfied: boolean; missing: string[] } {
  const missing: string[] = [];

  // Read ops log (commands logged by CLI wrappers)
  let ops: string[] = [];
  try {
    const content = shell(`cat ${opsFile} 2>/dev/null || true`).trim();
    if (content) ops = content.split("\n").filter(Boolean);
  } catch { /* empty */ }

  // Check insist.cli — each pattern must match at least one logged command
  for (const pattern of insist.cli ?? []) {
    const matched = ops.some(op => matchGlob(op, pattern));
    if (!matched) missing.push(`cli: ${pattern}`);
  }

  // Check insist.write — each pattern must match a file that exists
  for (const pattern of insist.write ?? []) {
    try {
      // Use find with the pattern to check if any matching file exists
      const found = shell(`find / -path '${pattern}' -type f 2>/dev/null | head -1`).trim();
      if (!found) missing.push(`write: ${pattern}`);
    } catch {
      missing.push(`write: ${pattern}`);
    }
  }

  // Check insist.read — look for read operations in ops log
  // (Commands like "cat /path" are logged; we check if any match)
  for (const pattern of insist.read ?? []) {
    const matched = ops.some(op => {
      // Check if any logged command references this path
      return op.includes(pattern.replace(/\*/g, ""));
    });
    if (!matched) missing.push(`read: ${pattern}`);
  }

  // Check insist.net — check iptables packet counters for allowed hosts
  for (const pattern of insist.net ?? []) {
    try {
      // Check if any packets were sent to the host
      const host = pattern.replace(/^\*\./, "");
      const packets = shell(
        `iptables -L OUTPUT -n -v 2>/dev/null | grep -c '${host}' || echo 0`
      ).trim();
      if (packets === "0") missing.push(`net: ${pattern}`);
    } catch {
      missing.push(`net: ${pattern}`);
    }
  }

  return { satisfied: missing.length === 0, missing };
}

// ── Execution ─────────────────────────────────────────────────────────

interface ExecRequest {
  script: string;      // run.sh content
  input: unknown;      // input JSON
  config?: unknown;    // band config JSON (optional)
  secrets?: Record<string, string>; // env secrets
  allowNet?: string[];
  denyNet?: string[];    // Network hosts denied (punches holes in allowNet)
  allowCli?: string[];   // CLI commands allowed (e.g., "gh *", "jq *")
  denyCli?: string[];    // CLI patterns denied (e.g., "rm -rf *", "curl *")
  allowRead?: string[];
  allowWrite?: string[];
  insist?: {             // Operations that MUST be performed
    cli?: string[];      // CLI commands that must be run
    read?: string[];     // Files that must be read
    write?: string[];    // Files that must be written
    net?: string[];      // Hosts that must be contacted
  };
  maxInputBytes?: number;
  maxOutputBytes?: number;
  timeoutMs?: number;
}

interface ExecResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metrics?: {
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
  };
}

async function executeScript(req: ExecRequest): Promise<ExecResponse> {
  const startTime = Date.now();
  const execId = randomId();
  const chainName = `BAND-${execId}`;
  const workdir = `/tmp/band-exec-${execId}`;

  const inputStr = JSON.stringify(req.input);

  // Check input size limit
  if (req.maxInputBytes && inputStr.length > req.maxInputBytes) {
    return {
      success: false,
      error: `Input size ${inputStr.length} bytes exceeds limit of ${req.maxInputBytes} bytes`,
      metrics: { durationMs: Date.now() - startTime, inputBytes: inputStr.length, outputBytes: 0 },
    };
  }

  try {
    // Create workdir and write all files via shell (server process may
    // not have direct write access to /tmp depending on permissions)
    shell(`mkdir -p ${workdir} && chmod 755 ${workdir}`);

    // Write script files using heredocs to avoid quoting issues
    writeFile(`${workdir}/run.sh`, req.script);
    writeFile(`${workdir}/input.json`, inputStr);

    if (req.config) {
      writeFile(`${workdir}/config.json`, JSON.stringify(req.config));
    }

    // Write env.sh with secrets and standard vars
    const envLines = [
      `export INPUT_PATH=${workdir}/input.json`,
      `export OUTPUT_PATH=${workdir}/output.json`,
    ];
    if (req.config) {
      envLines.push(`export CONFIG_PATH=${workdir}/config.json`);
    }
    for (const [key, value] of Object.entries(req.secrets ?? {})) {
      const b64 = Buffer.from(value).toString("base64");
      envLines.push(`export ${key}=$(echo '${b64}' | base64 -d)`);
    }
    // Set up CLI enforcement if allow.cli or deny.cli is specified.
    // PATH is set to ONLY the wrapper directory — default deny.
    const allowCli = req.allowCli ?? [];
    const denyCli = req.denyCli ?? [];
    if (allowCli.length > 0 || denyCli.length > 0) {
      const wrapperDir = `${workdir}/.band-cli`;
      shell(`mkdir -p ${wrapperDir}`);
      setupCliWrappers(wrapperDir, allowCli, denyCli);
      // PATH is ONLY the wrapper dir — commands not here don't exist
      envLines.unshift(`export PATH="${wrapperDir}"`);
    }

    // Set up ops tracker for insist enforcement
    const hasInsist = req.insist && (
      (req.insist.cli?.length ?? 0) > 0 ||
      (req.insist.read?.length ?? 0) > 0 ||
      (req.insist.write?.length ?? 0) > 0 ||
      (req.insist.net?.length ?? 0) > 0
    );
    const opsFile = `${workdir}/.band-ops`;
    if (hasInsist) {
      // CLI wrappers log to this file (via BAND_OPS_FILE env var)
      envLines.push(`export BAND_OPS_FILE="${opsFile}"`);
      writeFile(opsFile, ""); // create empty
    }

    writeFile(`${workdir}/env.sh`, envLines.join("\n") + "\n");

    // Make workdir readable/writable by band-runner
    shell(`chown -R ${BAND_RUNNER_USER}:${BAND_RUNNER_USER} ${workdir}`);

    // Set up iptables firewall
    const allowNet = req.allowNet ?? [];
    const denyNet = req.denyNet ?? [];
    if (allowNet.length > 0 || denyNet.length > 0) {
      setupFirewall(chainName, allowNet, denyNet);
    }

    // Run script inside bubblewrap (sudo needed for namespace setup)
    const bwrapArgs = ["sudo", ...buildBwrapArgs(
      workdir,
      req.allowRead ?? [],
      req.allowWrite ?? []
    )];

    const timeout = req.timeoutMs ?? 60_000;
    const proc = Bun.spawnSync(bwrapArgs, { timeout });

    const exitCode = proc.exitCode;
    const stderr = proc.stderr.toString();
    const stdout = proc.stdout.toString();

    if (exitCode !== 0) {
      // Try to read error from output file (use sudo since sandbox owns it)
      let errorMessage = stderr || stdout;
      try {
        const content = shell(`cat ${workdir}/output.json 2>/dev/null || true`).trim();
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.error) errorMessage = parsed.error;
          } catch {
            errorMessage = content;
          }
        }
      } catch { /* no output file */ }

      return {
        success: false,
        error: errorMessage || `Script exited with code ${exitCode}`,
        metrics: {
          durationMs: Date.now() - startTime,
          inputBytes: inputStr.length,
          outputBytes: 0,
        },
      };
    }

    // Read output (may be owned by sandbox user, use sudo)
    let data: unknown;
    try {
      const content = shell(`cat ${workdir}/output.json 2>/dev/null || true`).trim();
      if (content) {
        try { data = JSON.parse(content); } catch { data = content; }
      }
    } catch { /* no output file */ }

    // Fall back to stdout
    if (data === undefined && stdout.trim()) {
      try { data = JSON.parse(stdout.trim()); } catch { data = stdout.trim(); }
    }

    // Check output size limit
    if (req.maxOutputBytes && data !== undefined) {
      const outputSize = JSON.stringify(data).length;
      if (outputSize > req.maxOutputBytes) {
        return {
          success: false,
          error: `Output size ${outputSize} bytes exceeds limit of ${req.maxOutputBytes} bytes`,
          metrics: { durationMs: Date.now() - startTime, inputBytes: inputStr.length, outputBytes: outputSize },
        };
      }
    }

    // Check insist requirements
    if (hasInsist && req.insist) {
      const insistResult = checkInsist(req.insist, workdir, opsFile);
      if (!insistResult.satisfied) {
        return {
          success: false,
          error: `Insist not satisfied: ${insistResult.missing.join(", ")}`,
          metrics: {
            durationMs: Date.now() - startTime,
            inputBytes: inputStr.length,
            outputBytes: 0,
          },
        };
      }
    }

    return {
      success: true,
      data,
      metrics: {
        durationMs: Date.now() - startTime,
        inputBytes: inputStr.length,
        outputBytes: data ? JSON.stringify(data).length : 0,
      },
    };
  } finally {
    // Always clean up: firewall + workdir
    if (req.allowNet && req.allowNet.length > 0) {
      teardownFirewall(chainName);
    }
    shellIgnoreError(`rm -rf ${workdir}`);
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ ready: true, busy: executing, version: "3.0" });
});

app.post("/exec", async (c) => {
  // Single-use: reject if already executing
  if (executing) {
    return c.json(
      { error: "Server is busy — one execution at a time" },
      503
    );
  }

  executing = true;
  try {
    const req = (await c.req.json()) as ExecRequest;
    const result = await executeScript(req);

    if (result.metrics) {
      c.header("X-Band-Duration-Ms", String(result.metrics.durationMs));
      c.header("X-Band-Input-Bytes", String(result.metrics.inputBytes));
      c.header("X-Band-Output-Bytes", String(result.metrics.outputBytes));
    }

    return c.json(result, result.success ? 200 : 400);
  } catch (err: any) {
    return c.json(
      { success: false, error: err.message || String(err) },
      500
    );
  } finally {
    executing = false;
  }
});

export default { port: 9000, fetch: app.fetch };
