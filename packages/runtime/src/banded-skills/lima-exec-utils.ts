/**
 * Shared utility functions for Lima VM execution.
 *
 * These functions are used by:
 * - band-server.ts (inside the VM) — for building bwrap and firewall commands
 * - lima-exec.ts re-exports (on host) — for unit testing
 */

/**
 * Build a bubblewrap (bwrap) command that runs a script inside a
 * mount namespace with only system binaries and the workdir visible.
 */
export function buildBwrapCommand(
  vmWorkdir: string,
  userIds?: { uid: number; gid: number },
  fileRules?: { allowRead: string[]; allowWrite: string[] }
): string {
  // No --unshare-user: preserves real UID for iptables --uid-owner matching.
  // Process runs as band-runner via sudo -u inside the sandbox.
  const parts = [
    "bwrap",
    "--ro-bind /usr /usr",
    "--ro-bind /lib /lib",
    "--ro-bind /bin /bin",
    "--ro-bind /sbin /sbin",
    "--symlink usr/lib64 /lib64",
    "--ro-bind /etc/resolv.conf /etc/resolv.conf",
    "--ro-bind-try /etc/ssl /etc/ssl",
    "--ro-bind-try /etc/ca-certificates /etc/ca-certificates",
    "--ro-bind-try /etc/alternatives /etc/alternatives",
    "--proc /proc",
    "--dev /dev",
    "--tmpfs /tmp",
    "--tmpfs /home",
    `--bind ${vmWorkdir} ${vmWorkdir}`,
  ];

  if (fileRules) {
    const mounted = new Set<string>();
    for (const pattern of fileRules.allowRead) {
      const dir = extractMountPath(pattern);
      if (dir && !mounted.has(dir)) {
        parts.push(`--ro-bind-try ${dir} ${dir}`);
        mounted.add(dir);
      }
    }
    for (const pattern of fileRules.allowWrite) {
      const dir = extractMountPath(pattern);
      if (dir && !mounted.has(dir)) {
        parts.push(`--bind-try ${dir} ${dir}`);
        mounted.add(dir);
      }
    }
  }

  parts.push(
    // System files needed by sudo, DNS, and TLS
    "--ro-bind /etc/passwd /etc/passwd",
    "--ro-bind /etc/group /etc/group",
    "--ro-bind-try /etc/sudoers /etc/sudoers",
    "--ro-bind-try /etc/sudoers.d /etc/sudoers.d",
    "--ro-bind-try /etc/pam.d /etc/pam.d",
    "--ro-bind-try /etc/security /etc/security",
    "--ro-bind-try /etc/login.defs /etc/login.defs",
    "--ro-bind-try /etc/nsswitch.conf /etc/nsswitch.conf",
    // DNS resolver (systemd-resolved socket)
    "--ro-bind-try /run/systemd/resolve /run/systemd/resolve",
    "--die-with-parent",
    `-- /usr/bin/sudo -u band-runner /bin/bash -c 'source ${vmWorkdir}/env.sh && source ${vmWorkdir}/run.sh'`,
  );
  return parts.join(" ");
}

/**
 * Extract a concrete mount path from a glob pattern.
 */
export function extractMountPath(pattern: string): string | null {
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
 * Build an iptables/ip6tables setup script for the given network rules.
 */
export function buildFirewallScript(
  chainName: string,
  rules?: { allowNet: string[]; denyNet: string[] }
): string | null {
  if (!rules || rules.allowNet.length === 0) return null;

  const firewallTables = [
    { table: "iptables", resolver: "ahostsv4" },
    { table: "ip6tables", resolver: "ahostsv6" },
  ];
  const lines: string[] = [];

  for (const { table } of firewallTables) {
    lines.push(
      `${table} -N ${chainName} 2>/dev/null || ${table} -F ${chainName}`,
      `${table} -A ${chainName} -o lo -j ACCEPT`,
      `${table} -A ${chainName} -m state --state ESTABLISHED,RELATED -j ACCEPT`,
      `${table} -A ${chainName} -p udp --dport 53 -j ACCEPT`,
      `${table} -A ${chainName} -p tcp --dport 53 -j ACCEPT`,
    );
  }

  const addHostRules = (host: string) => {
    for (const { table, resolver } of firewallTables) {
      lines.push(
        `for ip in $(getent ${resolver} "${host}" 2>/dev/null | awk '{print $1}' | sort -u); do`,
        `  ${table} -A ${chainName} -d "$ip" -j ACCEPT`,
        `done`,
      );
    }
  };

  for (const host of rules.allowNet) {
    if (host === "*") return null;

    if (host.startsWith("*.")) {
      const baseDomain = host.slice(2);
      lines.push(`# Allow ${host}`);
      addHostRules(baseDomain);
      for (const prefix of ["api", "www"]) {
        addHostRules(`${prefix}.${baseDomain}`);
      }
    } else {
      lines.push(`# Allow ${host}`);
      addHostRules(host);
    }
  }

  for (const { table } of firewallTables) {
    lines.push(`${table} -A ${chainName} -j REJECT`);
  }
  // Only route band-runner's new connections through this chain
  for (const { table } of firewallTables) {
    lines.push(`${table} -I OUTPUT 1 -m state --state NEW -j ${chainName}`);
  }

  return lines.join("\n");
}
