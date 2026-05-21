/**
 * Band Execution Server — runs inside the Lima VM.
 *
 * Cooked sandbox model:
 * - First request with a set of permissions "cooks" the sandbox:
 *   iptables chain, CLI wrappers, bwrap mount list.
 * - Subsequent requests with the same permissions reuse the cook (ms, not 100s of ms).
 * - Different permissions auto-recook (teardown old, setup new).
 * - POST /flush tears down the current cook manually.
 *
 * Per-request (whether cooked or not):
 * 1. Write script + input + secrets to a fresh workdir
 * 2. Run inside bwrap sandbox using the cooked CLI wrappers and mount list
 * 3. Read output, check insist rules, cleanup workdir
 *
 * Rejects concurrent requests — one execution at a time.
 *
 * This file is deployed to the VM as ~/bands-server/server.ts
 * and run via systemd as a long-lived service.
 */

import { Hono } from "hono";
import { createHash } from "crypto";
import { buildCliWrapperScript, buildDenyPatternsFile, SAFE_CMD_NAME } from "./cli-wrapper";

const BAND_RUNNER_USER = "band-runner";
let executing = false;

// Get band-runner uid/gid once at startup
function getBandRunnerIds(): { uid: number; gid: number } {
  const uidResult = Bun.spawnSync(["id", "-u", BAND_RUNNER_USER]);
  const gidResult = Bun.spawnSync(["id", "-g", BAND_RUNNER_USER]);
  if (uidResult.exitCode !== 0 || gidResult.exitCode !== 0) {
    throw new Error(`User "${BAND_RUNNER_USER}" not found. Run setup to create it.`);
  }
  const uid = parseInt(uidResult.stdout.toString().trim());
  const gid = parseInt(gidResult.stdout.toString().trim());
  if (isNaN(uid) || isNaN(gid)) {
    throw new Error(`Failed to parse uid/gid for "${BAND_RUNNER_USER}".`);
  }
  return { uid, gid };
}

let bandRunnerIds: { uid: number; gid: number } | null = null;

function getCachedBandRunnerIds(): { uid: number; gid: number } {
  bandRunnerIds ??= getBandRunnerIds();
  return bandRunnerIds;
}

// ── Cook state ───────────────────────────────────────────────────────

interface Cook {
  id: string;
  wrapperDir: string;
  allowCli: string[];
  denyCli: string[];
  allowRead: string[];
  allowWrite: string[];
  trackOps: boolean;
}

let currentCook: Cook | null = null;
const globCache = new Map<string, Bun.Glob>();

/**
 * Hash the sandbox-relevant permissions to produce a cook ID.
 * Only CLI wrappers and bwrap mounts are cooked (stable, expensive to set up).
 * Network rules (iptables) are set up per-request because DNS→IP resolution
 * goes stale as CDNs rotate IPs.
 */
function computeCookId(req: ExecRequest, trackOps = false): string {
  const key = JSON.stringify({
    cli: (req.allowCli ?? []).slice().sort(),
    dcli: (req.denyCli ?? []).slice().sort(),
    read: (req.allowRead ?? []).slice().sort(),
    write: (req.allowWrite ?? []).slice().sort(),
    ops: trackOps,
  });
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/**
 * Ensure the sandbox is cooked for the given permissions.
 * Returns the current cook, setting up or recooking as needed.
 */
function ensureCooked(req: ExecRequest, trackOps = false): Cook {
  const id = computeCookId(req, trackOps);

  if (currentCook && currentCook.id === id) {
    return currentCook;
  }

  // Teardown old cook if present
  if (currentCook) {
    flushCook();
  }

  // Setup new cook (CLI wrappers + bwrap mounts only, not iptables)
  const cookDir = `/var/band-cook-${id}`;
  const wrapperDir = `${cookDir}/.band-cli`;

  shell(`mkdir -p ${wrapperDir}`);

  // Setup CLI wrappers (cooked — stable across requests)
  const allowCli = req.allowCli ?? [];
  const denyCli = req.denyCli ?? [];
  if (allowCli.length > 0 || denyCli.length > 0 || trackOps) {
    setupCliWrappers(wrapperDir, allowCli, denyCli, trackOps);
  }

  currentCook = {
    id,
    wrapperDir,
    allowCli,
    denyCli,
    allowRead: req.allowRead ?? [],
    allowWrite: req.allowWrite ?? [],
    trackOps,
  };

  return currentCook;
}

/**
 * Tear down the current cook: CLI wrapper dir.
 * (Iptables chains are per-request and cleaned up in executeScript.)
 */
function flushCook(): void {
  if (!currentCook) return;
  shellIgnoreError(`rm -rf /var/band-cook-${currentCook.id}`);
  currentCook = null;
}

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

/** Reject values containing shell metacharacters. Used for any band-config value interpolated into shell commands. */
function shellSafe(value: string, label: string): string {
  if (/[;`$(){}|&<>!\\"\n\r]/.test(value)) {
    throw new Error(`Unsafe characters in ${label}: ${value}`);
  }
  return value;
}

function writeFile(path: string, content: string): void {
  const b64 = Buffer.from(content).toString("base64");
  shell(`echo '${b64}' | base64 -d > ${path}`);
}

// ── Firewall ──────────────────────────────────────────────────────────

const FIREWALL_TABLES = [
  { table: "iptables", resolver: "ahostsv4" },
  { table: "ip6tables", resolver: "ahostsv6" },
];

function addResolvedFirewallRule(
  cmds: string[],
  chainName: string,
  host: string,
  target: "ACCEPT" | "REJECT"
): void {
  for (const { table, resolver } of FIREWALL_TABLES) {
    cmds.push(
      `for ip in $(getent ${resolver} "${host}" 2>/dev/null | awk '{print $1}' | sort -u); do ${table} -A ${chainName} -d "$ip" -j ${target}; done`
    );
  }
}

function setupFirewall(
  chainName: string,
  allowNet: string[],
  denyNet: string[]
): void {
  if (allowNet.length === 0 && denyNet.length === 0) return;
  if (allowNet.includes("*") && denyNet.length === 0) return;

  // Check if iptables/ip6tables are available.
  try {
    shell("iptables -L OUTPUT -n >/dev/null 2>&1");
    shell("ip6tables -L OUTPUT -n >/dev/null 2>&1");
  } catch {
    return;
  }

  const cmds: string[] = [];
  for (const { table } of FIREWALL_TABLES) {
    cmds.push(
      `${table} -N ${chainName} 2>/dev/null || ${table} -F ${chainName}`,
      `${table} -A ${chainName} -o lo -j ACCEPT`,
      `${table} -A ${chainName} -m state --state ESTABLISHED,RELATED -j ACCEPT`,
      `${table} -A ${chainName} -p udp --dport 53 -j ACCEPT`,
      `${table} -A ${chainName} -p tcp --dport 53 -j ACCEPT`,
    );
  }

  // Deny rules FIRST — they punch holes in allow (deny takes precedence)
  for (const host of denyNet) {
    const resolveHost = shellSafe(host.startsWith("*.") ? host.slice(2) : host, "deny.net host");
    addResolvedFirewallRule(cmds, chainName, resolveHost, "REJECT");
  }

  // Allow rules
  for (const host of allowNet) {
    if (host === "*") continue;
    if (host.startsWith("*.")) {
      const base = shellSafe(host.slice(2), "allow.net host");
      addResolvedFirewallRule(cmds, chainName, base, "ACCEPT");
      addResolvedFirewallRule(cmds, chainName, `api.${base}`, "ACCEPT");
      addResolvedFirewallRule(cmds, chainName, `www.${base}`, "ACCEPT");
    } else {
      const safeHost = shellSafe(host, "allow.net host");
      addResolvedFirewallRule(cmds, chainName, safeHost, "ACCEPT");
    }
  }

  if (!allowNet.includes("*")) {
    for (const { table } of FIREWALL_TABLES) {
      cmds.push(`${table} -A ${chainName} -j REJECT`);
    }
  }

  const { uid } = getCachedBandRunnerIds();
  for (const { table } of FIREWALL_TABLES) {
    cmds.push(`${table} -I OUTPUT 1 -m owner --uid-owner ${uid} -m state --state NEW -j ${chainName}`);
  }

  shell(cmds.join("\n"));
}

function teardownFirewall(chainName: string): void {
  const { uid } = getCachedBandRunnerIds();
  shellIgnoreError(
    `iptables -D OUTPUT -m owner --uid-owner ${uid} -m state --state NEW -j ${chainName} 2>/dev/null; ` +
      `iptables -F ${chainName} 2>/dev/null; ` +
      `iptables -X ${chainName} 2>/dev/null; ` +
      `ip6tables -D OUTPUT -m owner --uid-owner ${uid} -m state --state NEW -j ${chainName} 2>/dev/null; ` +
      `ip6tables -F ${chainName} 2>/dev/null; ` +
      `ip6tables -X ${chainName} 2>/dev/null`
  );
}

// ── Bubblewrap ────────────────────────────────────────────────────────

function buildBwrapArgs(
  workdir: string,
  cook: Cook,
  denyRead: string[] = [],
  denyWrite: string[] = []
): string[] {
  const args = ["bwrap"];

  args.push(
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/sbin", "/sbin",
    "--ro-bind", "/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64",
    "--ro-bind", "/etc", "/etc",
    "--bind-try", "/run", "/run",
    "--proc", "/proc",
    "--dev", "/dev",
    "--perms", "1777", "--tmpfs", "/tmp",
    "--perms", "1777", "--tmpfs", "/home",
    "--bind", workdir, workdir,
    "--die-with-parent",
  );

  // Mount the cooked CLI wrapper dir into the sandbox.
  // Mount it at a fixed path inside the workdir so PATH in env.sh can find it.
  if (cook.allowCli.length > 0 || cook.denyCli.length > 0) {
    args.push("--ro-bind", cook.wrapperDir, `${workdir}/.band-cli`);
  }

  // File access mounts from the cook, excluding deny patterns.
  // A dir is excluded if any deny pattern matches it or its children.
  const mounted = new Set<string>();
  for (const pattern of cook.allowRead) {
    const dir = extractMountDir(pattern);
    if (dir && !mounted.has(dir) && !isDenied(dir, denyRead)) {
      args.push("--ro-bind-try", dir, dir);
      mounted.add(dir);
    }
  }
  for (const pattern of cook.allowWrite) {
    const dir = extractMountDir(pattern);
    if (dir && !mounted.has(dir) && !isDenied(dir, denyWrite)) {
      args.push("--bind-try", dir, dir);
      mounted.add(dir);
    }
  }

  args.push("--", "/usr/bin/sudo", "-u", BAND_RUNNER_USER, "/bin/bash", "-c",
    `source ${workdir}/env.sh && source ${workdir}/run.sh`
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

/**
 * Check if a directory path matches any deny pattern.
 * A dir is denied if any deny pattern targets it or a parent of it.
 */
function isDenied(dir: string, denyPatterns: string[]): boolean {
  for (const pattern of denyPatterns) {
    const denyDir = extractMountDir(pattern);
    if (denyDir && (dir === denyDir || dir.startsWith(denyDir + "/"))) {
      return true;
    }
    // Also check exact pattern match (e.g., deny "/tmp/secrets/**" denies "/tmp/secrets")
    const concrete = pattern.replace(/[*?{[\]]/g, "");
    if (dir === concrete || concrete.startsWith(dir + "/")) {
      return true;
    }
  }
  return false;
}

// ── CLI deny wrappers ─────────────────────────────────────────────────

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

function setupCliWrappers(
  wrapperDir: string,
  allowPatterns: string[],
  denyPatterns: string[],
  trackOps = false
): void {
  const allowedCommands = new Set(ESSENTIAL_COMMANDS);
  for (const pattern of allowPatterns) {
    const cmd = pattern.split(/\s+/)[0];
    if (cmd && SAFE_CMD_NAME.test(cmd)) {
      allowedCommands.add(cmd);
    }
  }

  const denyByCmd = new Map<string, string[]>();
  for (const pattern of denyPatterns) {
    const cmd = pattern.split(/\s+/)[0];
    if (!cmd || !SAFE_CMD_NAME.test(cmd)) continue;
    const existing = denyByCmd.get(cmd) || [];
    existing.push(pattern);
    denyByCmd.set(cmd, existing);
  }

  for (const cmd of allowedCommands) {
    if (!SAFE_CMD_NAME.test(cmd)) continue;
    let realPath: string;
    try {
      realPath = shell(`readlink -f $(which ${cmd}) 2>/dev/null`).trim();
    } catch { continue; }
    if (!realPath) continue;

    const denyPats = denyByCmd.get(cmd) || [];
    if (denyPats.length > 0) {
      writeFile(`${wrapperDir}/.deny-${cmd}`, buildDenyPatternsFile(denyPats));
    }
    const trackLine = trackOps ? buildInsistTracker(cmd) : "";
    writeFile(`${wrapperDir}/${cmd}`, buildCliWrapperScript(cmd, realPath, denyPats.length > 0, trackLine));
    shell(`chmod +x ${wrapperDir}/${cmd}`);
  }
}

/**
 * Generates wrapper-side operation tracking for common file commands.
 * Read-like commands log each non-flag, non-URL argument as a read; write-like
 * commands log those arguments as writes. For cp/mv, the final path argument is
 * treated as the write destination and earlier path arguments are reads.
 */
function buildInsistTracker(cmd: string): string {
  return `if [ -n "$BAND_OPS_FILE" ]; then
  case "${cmd}" in
    cat|head|tail|grep|sed|awk|sort|uniq|wc|tr|cut)
      for arg in "$@"; do
        case "$arg" in -*|*://*) continue ;; esac
        [ -n "$arg" ] && echo "read:$arg" >> "$BAND_OPS_FILE"
      done
      ;;
    tee|touch)
      for arg in "$@"; do
        case "$arg" in -*|*://*) continue ;; esac
        [ -n "$arg" ] && echo "write:$arg" >> "$BAND_OPS_FILE"
      done
      ;;
    cp|mv)
      args=()
      for arg in "$@"; do
        case "$arg" in -*) continue ;; esac
        args+=("$arg")
      done
      # cp/mv use the final path argument as the write destination.
      last=$((\${#args[@]} - 1))
      for i in "\${!args[@]}"; do
        if [ "$i" -eq "$last" ]; then
          echo "write:\${args[$i]}" >> "$BAND_OPS_FILE"
        else
          echo "read:\${args[$i]}" >> "$BAND_OPS_FILE"
        fi
      done
      ;;
  esac
fi`;
}

function buildRedirectTracker(): string {
  return `_band_log_redirect() {
  local cmd="$BASH_COMMAND"
  # Match simple > and >> redirections and capture the redirected path.
  local re='(^|[[:space:]])[0-9]*>{1,2}[[:space:]]*([^[:space:];|&]+)'
  [[ -n "$BAND_OPS_FILE" ]] || return 0
  if [[ "$cmd" =~ $re ]]; then
    local p="\${BASH_REMATCH[2]}"
    p="\${p%\\"}"
    p="\${p#\\"}"
    p="\${p%\\'}"
    p="\${p#\\'}"
    [[ -n "$p" ]] && echo "write:$p" >> "$BAND_OPS_FILE"
  fi
  return 0
}`;
}

// ── Insist checking ───────────────────────────────────────────────────

export function matchGlob(str: string, pattern: string): boolean {
  let glob = globCache.get(pattern);
  if (!glob) {
    glob = new Bun.Glob(pattern);
    globCache.set(pattern, glob);
  }
  return glob.match(str);
}

function matchCliPattern(str: string, pattern: string): boolean {
  try {
    const regex = "^" + pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")
      + "$";
    return new RegExp(regex).test(str);
  } catch {
    return str === pattern;
  }
}

function stripShellQuotes(path: string): string {
  if (
    (path.startsWith('"') && path.endsWith('"')) ||
    (path.startsWith("'") && path.endsWith("'"))
  ) {
    return path.slice(1, -1);
  }
  return path;
}

function pathCandidates(path: string, workdir: string): string[] {
  const clean = stripShellQuotes(path);
  const candidates = new Set([clean]);

  if (clean.startsWith(workdir + "/")) {
    candidates.add(`.${clean.slice(workdir.length)}`);
  } else if (!clean.startsWith("/")) {
    const relative = clean.startsWith("./") ? clean : `./${clean}`;
    candidates.add(relative);
    candidates.add(`${workdir}/${relative.replace(/^\.\//, "")}`);
  }

  return Array.from(candidates);
}

function pathMatches(path: string, pattern: string, workdir: string): boolean {
  return pathCandidates(path, workdir).some(candidate => matchGlob(candidate, pattern));
}

export function checkInsistFromOps(
  insist: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] },
  workdir: string,
  ops: string[]
): { satisfied: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const pattern of insist.cli ?? []) {
    const matched = ops.some(op =>
      !op.startsWith("read:") &&
      !op.startsWith("write:") &&
      matchCliPattern(op, pattern)
    );
    if (!matched) missing.push(`cli: ${pattern}`);
  }

  for (const pattern of insist.write ?? []) {
    const matched = ops.some(op =>
      op.startsWith("write:") && pathMatches(op.slice("write:".length), pattern, workdir)
    );
    if (!matched) missing.push(`write: ${pattern}`);
  }

  for (const pattern of insist.read ?? []) {
    const matched = ops.some(op =>
      op.startsWith("read:") && pathMatches(op.slice("read:".length), pattern, workdir)
    );
    if (!matched) missing.push(`read: ${pattern}`);
  }

  return { satisfied: missing.length === 0, missing };
}

function checkInsist(
  insist: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] },
  workdir: string,
  opsFile: string
): { satisfied: boolean; missing: string[] } {
  let ops: string[] = [];
  try {
    const content = shell(`cat ${opsFile} 2>/dev/null || true`).trim();
    if (content) ops = content.split("\n").filter(Boolean);
  } catch { /* empty */ }

  const result = checkInsistFromOps(insist, workdir, ops);
  const missing = result.missing;

  for (const pattern of insist.net ?? []) {
    try {
      const host = shellSafe(pattern.replace(/^\*\./, ""), "insist.net host");
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
  script: string;
  input: unknown;
  config?: unknown;
  secrets?: Record<string, string>;
  allowNet?: string[];
  denyNet?: string[];
  allowCli?: string[];
  denyCli?: string[];
  allowRead?: string[];
  denyRead?: string[];
  allowWrite?: string[];
  denyWrite?: string[];
  insist?: {
    cli?: string[];
    read?: string[];
    write?: string[];
    net?: string[];
  };
  timeoutMs?: number;
  sandboxMode?: "bwrap" | "worktree-chmod";
  repoPath?: string;
}

interface ExecResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  cooked?: boolean;
  cookId?: string;
  metrics?: {
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
  };
}

async function executeScript(req: ExecRequest): Promise<ExecResponse> {
  const startTime = Date.now();
  const execId = randomId();
  const workdir = `/tmp/band-exec-${execId}`;

  const inputStr = JSON.stringify(req.input);
  const hasInsist = !!req.insist && (
    (req.insist.cli?.length ?? 0) > 0 ||
    (req.insist.read?.length ?? 0) > 0 ||
    (req.insist.write?.length ?? 0) > 0 ||
    (req.insist.net?.length ?? 0) > 0
  );

  // Ensure sandbox is cooked (reuses if permissions match)
  const cook = ensureCooked(req, hasInsist);
  const wasCooked = currentCook?.id === cook.id;

  try {
    // Per-request: create workdir with script, input, env
    shell(`mkdir -p ${workdir} && chmod 755 ${workdir}`);

    writeFile(`${workdir}/run.sh`, req.script);
    writeFile(`${workdir}/input.json`, inputStr);

    if (req.config) {
      writeFile(`${workdir}/config.json`, JSON.stringify(req.config));
    }

    // Build env.sh pointing to the cooked CLI wrappers
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

    // Point PATH to the cooked CLI wrapper dir (mounted at workdir/.band-cli inside bwrap)
    const hasCliRestrictions = cook.allowCli.length > 0 || cook.denyCli.length > 0;
    if (hasCliRestrictions) {
      envLines.unshift(`export PATH="${workdir}/.band-cli"`);
    } else if (cook.trackOps) {
      envLines.unshift(`export PATH="${workdir}/.band-cli:$PATH"`);
    }
    if (cook.trackOps) {
      envLines.push(buildRedirectTracker());
    }
    if (hasCliRestrictions) {
      envLines.push(`shopt -s extdebug`);
      envLines.push(`_band_check() { local c="\${BASH_COMMAND%% *}"; [[ "$c" == /* ]] && { echo "DENIED: \$BASH_COMMAND (absolute paths blocked)" >&2; return 1; }; return 0; }`);
    }
    const debugHooks = [
      ...(hasCliRestrictions ? ["_band_check"] : []),
      ...(cook.trackOps ? ["_band_log_redirect"] : []),
    ];
    if (debugHooks.length > 0) {
      envLines.push(`trap '${debugHooks.join(" && ")}' DEBUG`);
    }

    // Ops tracker for insist enforcement
    const opsFile = `${workdir}/.band-ops`;
    if (hasInsist) {
      envLines.push(`export BAND_OPS_FILE="${opsFile}"`);
      writeFile(opsFile, "");
    }

    writeFile(`${workdir}/env.sh`, envLines.join("\n") + "\n");

    shell(`chown -R ${BAND_RUNNER_USER}:${BAND_RUNNER_USER} ${workdir}`);

    // Setup iptables per-request (DNS→IP resolution goes stale with CDN rotation)
    const allowNet = req.allowNet ?? [];
    const denyNet = req.denyNet ?? [];
    const chainName = `BAND-${execId}`;
    if (allowNet.length > 0 || denyNet.length > 0) {
      setupFirewall(chainName, allowNet, denyNet);
    }

    const timeout = req.timeoutMs ?? 60_000;
    let proc: ReturnType<typeof Bun.spawnSync>;

    if (req.sandboxMode === "worktree-chmod" && req.repoPath) {
      // Worktree + chmod sandbox: file isolation via POSIX permissions
      const { buildChmodPlan, buildChmodScript, buildSparseCheckoutPatterns, shellQuote } = await import("./worktree-chmod");
      const worktreePath = `/tmp/band-wt-${execId}`;

      try {
        // Create sparse-checkout worktree
        const sparsePatterns = buildSparseCheckoutPatterns(req.allowRead ?? [], req.allowWrite ?? []);
        shell(`git -C ${shellQuote(req.repoPath)} worktree add --detach ${shellQuote(worktreePath)} 2>/dev/null`);
        shell(`cd ${shellQuote(worktreePath)} && git sparse-checkout init --cone`);
        if (sparsePatterns.length > 0 && !sparsePatterns.includes("*")) {
          shell(`cd ${shellQuote(worktreePath)} && git sparse-checkout set ${sparsePatterns.map(shellQuote).join(" ")}`);
        }

        // Expand globs against actual filesystem to get concrete file lists
        const expandGlob = (patterns: string[]): string[] => {
          if (patterns.length === 0) return [];
          const results: string[] = [];
          for (const pattern of patterns) {
            const cleaned = pattern.replace(/^\.\//, "");
            const found = shell(`find ${shellQuote(worktreePath)} -path ${shellQuote(worktreePath + "/" + cleaned)} -type f 2>/dev/null || true`).trim();
            if (found) results.push(...found.split("\n").filter(Boolean));
          }
          return [...new Set(results)];
        };

        const readFiles = expandGlob(req.allowRead ?? []);
        const writeFiles = expandGlob(req.allowWrite ?? []);
        const denyReadFiles = expandGlob(req.denyRead ?? []);
        const denyWriteFiles = expandGlob(req.denyWrite ?? []);
        const denyFiles = [...new Set([...denyReadFiles, ...denyWriteFiles])];

        // Build and apply chmod plan
        const plan = buildChmodPlan(worktreePath, readFiles, writeFiles, denyFiles);
        const chmodScript = buildChmodScript(plan);
        writeFile(`${workdir}/chmod-plan.sh`, chmodScript);
        shell(`bash ${workdir}/chmod-plan.sh`);

        // Copy workdir files into worktree for script access
        shell(`cp ${workdir}/run.sh ${worktreePath}/.band-run.sh`);
        shell(`cp ${workdir}/env.sh ${worktreePath}/.band-env.sh`);
        shell(`cp ${workdir}/input.json ${worktreePath}/.band-input.json`);
        if (req.config) {
          shell(`cp ${workdir}/config.json ${worktreePath}/.band-config.json`);
        }
        shell(`chmod a+r ${worktreePath}/.band-run.sh ${worktreePath}/.band-env.sh ${worktreePath}/.band-input.json`);
        if (hasInsist) {
          shell(`touch ${worktreePath}/.band-ops && chmod a+rw ${worktreePath}/.band-ops`);
        }

        // Update env paths to point to worktree
        const envPatch = [
          `export INPUT_PATH=${worktreePath}/.band-input.json`,
          `export OUTPUT_PATH=${worktreePath}/.band-output.json`,
        ].join("\n");
        shell(`echo '${envPatch}' >> ${worktreePath}/.band-env.sh`);
        shell(`chmod a+rw ${worktreePath}/.band-env.sh`);

        // Create writable output location
        shell(`touch ${worktreePath}/.band-output.json && chmod a+rw ${worktreePath}/.band-output.json`);

        // Run as band-runner without bwrap
        proc = Bun.spawnSync(
          ["sudo", "-u", BAND_RUNNER_USER, "bash", "-c",
           `source ${worktreePath}/.band-env.sh && cd ${worktreePath} && bash ${worktreePath}/.band-run.sh`],
          { timeout }
        );

        // Copy output back to workdir
        shellIgnoreError(`cp ${worktreePath}/.band-output.json ${workdir}/output.json 2>/dev/null`);
        if (hasInsist) {
          shellIgnoreError(`cp ${worktreePath}/.band-ops ${opsFile} 2>/dev/null`);
        }
      } finally {
        // Teardown worktree
        shellIgnoreError(`chmod -R u+rwx ${worktreePath} 2>/dev/null`);
        shellIgnoreError(`git -C ${shellQuote(req.repoPath)} worktree remove --force ${shellQuote(worktreePath)} 2>/dev/null`);
        shellIgnoreError(`rm -rf ${worktreePath} 2>/dev/null`);
      }
    } else {
      // Default: bwrap mount-namespace sandbox
      const bwrapArgs = ["sudo", ...buildBwrapArgs(workdir, cook, req.denyRead ?? [], req.denyWrite ?? [])];
      proc = Bun.spawnSync(bwrapArgs, { timeout });
    }

    const exitCode = proc.exitCode;
    const stderr = proc.stderr.toString();
    const stdout = proc.stdout.toString();

    if (exitCode !== 0) {
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
        cooked: wasCooked,
        cookId: cook.id,
        metrics: {
          durationMs: Date.now() - startTime,
          inputBytes: inputStr.length,
          outputBytes: 0,
        },
      };
    }

    // Read output
    let data: unknown;
    try {
      const content = shell(`cat ${workdir}/output.json 2>/dev/null || true`).trim();
      if (content) {
        try { data = JSON.parse(content); } catch { data = content; }
      }
    } catch { /* no output file */ }

    if (data === undefined && stdout.trim()) {
      try { data = JSON.parse(stdout.trim()); } catch { data = stdout.trim(); }
    }

    // Check insist requirements
    if (hasInsist && req.insist) {
      const insistResult = checkInsist(req.insist, workdir, opsFile);
      if (!insistResult.satisfied) {
        return {
          success: false,
          error: `Insist not satisfied: ${insistResult.missing.join(", ")}`,
          cooked: wasCooked,
          cookId: cook.id,
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
      cooked: wasCooked,
      cookId: cook.id,
      metrics: {
        durationMs: Date.now() - startTime,
        inputBytes: inputStr.length,
        outputBytes: data ? JSON.stringify(data).length : 0,
      },
    };
  } finally {
    // Teardown per-request iptables + workdir. Cook state persists.
    if ((req.allowNet ?? []).length > 0 || (req.denyNet ?? []).length > 0) {
      teardownFirewall(`BAND-${execId}`);
    }
    shellIgnoreError(`rm -rf ${workdir}`);
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────

const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    ready: true,
    busy: executing,
    version: "4.0",
    cook: currentCook ? { id: currentCook.id } : null,
  });
});

app.post("/exec", async (c) => {
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

app.post("/flush", (c) => {
  flushCook();
  return c.json({ ok: true, message: "Cook flushed" });
});

export default { port: 9000, fetch: app.fetch };
