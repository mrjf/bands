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
  allowNet: string[]
): void {
  if (allowNet.length === 0) return;
  if (allowNet.includes("*")) return; // wildcard = don't restrict

  const cmds: string[] = [
    `iptables -N ${chainName} 2>/dev/null || iptables -F ${chainName}`,
    `iptables -A ${chainName} -o lo -j ACCEPT`,
    `iptables -A ${chainName} -m state --state ESTABLISHED,RELATED -j ACCEPT`,
    `iptables -A ${chainName} -p udp --dport 53 -j ACCEPT`,
    `iptables -A ${chainName} -p tcp --dport 53 -j ACCEPT`,
  ];

  for (const host of allowNet) {
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

  cmds.push(`iptables -A ${chainName} -j REJECT`);
  // Only route band-runner's new connections through this chain
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

/**
 * Convert a CLI glob pattern to a regex string.
 * "rm -rf *" → "^rm -rf .*$"
 */
function globToRegex(pattern: string): string {
  return "^" + pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape regex specials
    .replace(/\*/g, ".*")                    // * → .*
    .replace(/\?/g, ".")                     // ? → .
    + "$";
}

/**
 * Create wrapper scripts for commands that appear in deny.cli patterns.
 *
 * For each unique command prefix in deny patterns (e.g., "rm" from "rm -rf *"),
 * creates a wrapper in wrapperDir that:
 * 1. Reconstructs the full command line
 * 2. Checks against all deny patterns
 * 3. If denied: prints error to stderr, exits 126
 * 4. If allowed: exec's the real binary from its original path
 *
 * The wrapper dir is prepended to PATH, so the wrapper shadows the real binary.
 */
function setupDenyWrappers(wrapperDir: string, denyPatterns: string[]): void {
  // Group patterns by command name (first token)
  const cmdPatterns = new Map<string, string[]>();
  for (const pattern of denyPatterns) {
    const cmd = pattern.split(/\s+/)[0];
    if (!cmd) continue;
    const existing = cmdPatterns.get(cmd) || [];
    existing.push(pattern);
    cmdPatterns.set(cmd, existing);
  }

  for (const [cmd, patterns] of cmdPatterns) {
    // Find the real binary path (resolve through symlinks)
    let realPath: string;
    try {
      realPath = shell(`readlink -f $(which ${cmd}) 2>/dev/null`).trim();
    } catch {
      // Binary doesn't exist — no wrapper needed
      continue;
    }
    if (!realPath) continue;

    // Use a simple string comparison approach: convert glob patterns to
    // bash extended patterns and check with [[ == ]].
    // We write a match function that handles the conversion.
    const patternArray = patterns.map(p => `"${p.replace(/"/g, '\\"')}"`).join(" ");

    const wrapper = `#!/bin/bash
# Band deny wrapper for: ${cmd}
FULL_CMD="${cmd} $*"
DENY_PATTERNS=(${patternArray})
for P in "\${DENY_PATTERNS[@]}"; do
  if eval "[[ \\"\\$FULL_CMD\\" == \\$P ]]" 2>/dev/null; then
    echo "DENIED: $FULL_CMD" >&2
    exit 126
  fi
done
exec ${realPath} "$@"
`;

    writeFile(`${wrapperDir}/${cmd}`, wrapper);
    shell(`chmod +x ${wrapperDir}/${cmd}`);
  }
}

// ── Execution ─────────────────────────────────────────────────────────

interface ExecRequest {
  script: string;      // run.sh content
  input: unknown;      // input JSON
  config?: unknown;    // band config JSON (optional)
  secrets?: Record<string, string>; // env secrets
  allowNet?: string[];
  allowCli?: string[];   // CLI commands allowed (e.g., "gh *", "jq *")
  denyCli?: string[];    // CLI patterns denied (e.g., "rm -rf *", "curl *")
  allowRead?: string[];
  allowWrite?: string[];
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
    // Set up deny.cli wrappers if any deny patterns exist
    const denyCli = req.denyCli ?? [];
    if (denyCli.length > 0) {
      const wrapperDir = `${workdir}/.band-deny-wrappers`;
      shell(`mkdir -p ${wrapperDir}`);
      setupDenyWrappers(wrapperDir, denyCli);
      // Prepend wrapper dir to PATH so wrappers shadow real binaries
      envLines.unshift(`export PATH="${wrapperDir}:$PATH"`);
    }

    writeFile(`${workdir}/env.sh`, envLines.join("\n") + "\n");

    // Make workdir readable/writable by band-runner
    shell(`chown -R ${BAND_RUNNER_USER}:${BAND_RUNNER_USER} ${workdir}`);

    // Set up iptables firewall
    if (req.allowNet && req.allowNet.length > 0) {
      setupFirewall(chainName, req.allowNet);
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
