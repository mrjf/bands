/**
 * Worktree + chmod sandbox.
 *
 * Alternative to bwrap mount-namespace isolation. Uses git sparse-checkout
 * worktrees and POSIX file permissions to enforce allow/deny rules.
 *
 * Flow:
 *   1. Create a sparse-checkout worktree (only allowed paths exist)
 *   2. chmod -R 000 (deny everything)
 *   3. chmod a+x on traversal directories
 *   4. chmod a+r on allow.read files
 *   5. chmod a+rw on allow.write files
 *   6. chmod 000 on deny.read / deny.write (override allow)
 *   7. Run script as band-runner (unprivileged)
 *   8. Tear down worktree
 *
 * Security model: identical to bwrap — deny by default, allow selectively,
 * deny overrides allow. Enforcement is kernel-level POSIX permissions.
 */

import { join, dirname, relative, resolve, sep } from "path";

/**
 * Plan for chmod operations. Pure data — no side effects.
 */
export interface ChmodPlan {
  worktreeRoot: string;
  lockdownDirs: string[];
  traversalDirs: string[];
  readableFiles: string[];
  writableFiles: string[];
  deniedFiles: string[];
}

/**
 * Compute traversal directories needed for a set of file paths.
 * Returns all ancestor directories between worktreeRoot and each file,
 * deduplicated and sorted shortest-first.
 */
export function computeTraversalDirs(files: string[], worktreeRoot: string): string[] {
  const dirs = new Set<string>();
  const root = resolve(worktreeRoot);
  dirs.add(root);

  for (const file of files) {
    let dir = dirname(resolve(file));
    while (dir.length >= root.length && dir !== root) {
      dirs.add(dir);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return [...dirs].sort((a, b) => a.length - b.length);
}

/**
 * Filter out symlinks that point outside the worktree root.
 * Returns only safe paths.
 */
export function filterUnsafeSymlinks(
  files: string[],
  worktreeRoot: string,
  resolveLink: (path: string) => string | null
): { safe: string[]; unsafe: string[] } {
  const root = resolve(worktreeRoot);
  const safe: string[] = [];
  const unsafe: string[] = [];

  for (const file of files) {
    const target = resolveLink(file);
    if (target === null) {
      safe.push(file);
      continue;
    }
    const resolved = resolve(dirname(file), target);
    if (resolved.startsWith(root + sep) || resolved === root) {
      safe.push(file);
    } else {
      unsafe.push(file);
    }
  }

  return { safe, unsafe };
}

/**
 * Build a chmod plan from permission patterns and expanded file lists.
 *
 * readFiles/writeFiles are already-expanded absolute paths (glob expansion
 * happens at the call site using the actual filesystem).
 *
 * denyFiles are paths that matched deny.read or deny.write patterns —
 * these get chmod 000 AFTER the allow pass, overriding any grants.
 */
export function buildChmodPlan(
  worktreeRoot: string,
  readFiles: string[],
  writeFiles: string[],
  denyFiles: string[]
): ChmodPlan {
  const root = resolve(worktreeRoot);
  const allGranted = [...new Set([...readFiles, ...writeFiles])];
  const traversalDirs = computeTraversalDirs(allGranted, root);

  return {
    worktreeRoot: root,
    lockdownDirs: [root],
    traversalDirs,
    readableFiles: readFiles,
    writableFiles: writeFiles,
    deniedFiles: denyFiles,
  };
}

/**
 * Generate the shell script that applies a chmod plan.
 *
 * Ordering is critical for security:
 *   1. chmod -R 000 (deny all)
 *   2. chmod a+x on traversal dirs (allow navigation)
 *   3. chmod a+r on readable files
 *   4. chmod a+rw on writable files
 *   5. chmod 000 on denied files (deny overrides allow)
 *
 * Traversal dirs get a+x but NOT a+r — you can cd into them but not ls.
 * This prevents directory enumeration of files outside the allowed set.
 */
export function buildChmodScript(plan: ChmodPlan): string {
  const lines: string[] = ["#!/bin/bash", "set -euo pipefail", ""];

  // Phase 1: deny everything
  lines.push(`# Phase 1: deny all`);
  for (const dir of plan.lockdownDirs) {
    lines.push(`chmod -R 000 ${shellQuote(dir)}`);
  }
  lines.push("");

  // Phase 2: traversal (a+x only, no a+r)
  if (plan.traversalDirs.length > 0) {
    lines.push(`# Phase 2: traversal directories`);
    for (const dir of plan.traversalDirs) {
      lines.push(`chmod a+x ${shellQuote(dir)}`);
    }
    lines.push("");
  }

  // Phase 3: readable files (a+r)
  if (plan.readableFiles.length > 0) {
    lines.push(`# Phase 3: readable files`);
    for (const file of plan.readableFiles) {
      lines.push(`chmod a+r ${shellQuote(file)}`);
    }
    lines.push("");
  }

  // Phase 4: writable files (a+rw)
  if (plan.writableFiles.length > 0) {
    lines.push(`# Phase 4: writable files`);
    for (const file of plan.writableFiles) {
      lines.push(`chmod a+rw ${shellQuote(file)}`);
    }
    lines.push("");
  }

  // Phase 5: denied files (000 — overrides allow)
  if (plan.deniedFiles.length > 0) {
    lines.push(`# Phase 5: deny overrides`);
    for (const file of plan.deniedFiles) {
      lines.push(`chmod 000 ${shellQuote(file)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate git sparse-checkout patterns from band read/write globs.
 *
 * Git sparse-checkout cone mode works on directory prefixes.
 * We extract the directory portion of each pattern.
 */
export function buildSparseCheckoutPatterns(
  allowRead: string[],
  allowWrite: string[]
): string[] {
  const dirs = new Set<string>();

  for (const pattern of [...allowRead, ...allowWrite]) {
    const cleaned = pattern.replace(/^\.\//, "");
    const parts = cleaned.split("/");
    // Find the first directory component (before any wildcards or filename)
    const dirParts: string[] = [];
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].includes("*") || parts[i].includes("?")) break;
      dirParts.push(parts[i]);
    }
    const dir = dirParts.join("/");
    if (dir) {
      dirs.add(dir);
    } else {
      dirs.add("*");
    }
  }

  return [...dirs].sort();
}

/**
 * Generate the worktree setup script.
 */
export function buildWorktreeSetupScript(
  repoPath: string,
  worktreePath: string,
  sparsePatterns: string[]
): string {
  const lines = [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    `git -C ${shellQuote(repoPath)} worktree add --detach ${shellQuote(worktreePath)} 2>/dev/null`,
    `cd ${shellQuote(worktreePath)}`,
    `git sparse-checkout init --cone`,
  ];

  if (sparsePatterns.length > 0 && !sparsePatterns.includes("*")) {
    lines.push(`git sparse-checkout set ${sparsePatterns.map(shellQuote).join(" ")}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Generate the worktree teardown script.
 */
export function buildWorktreeTeardownScript(
  repoPath: string,
  worktreePath: string
): string {
  return [
    "#!/bin/bash",
    `chmod -R u+rwx ${shellQuote(worktreePath)} 2>/dev/null || true`,
    `git -C ${shellQuote(repoPath)} worktree remove --force ${shellQuote(worktreePath)} 2>/dev/null || true`,
    `rm -rf ${shellQuote(worktreePath)} 2>/dev/null || true`,
    "",
  ].join("\n");
}

/**
 * Shell-quote a string to prevent injection.
 * Uses single quotes with escaped single quotes.
 */
export function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Validate that a path is safe (no path traversal, no null bytes).
 */
export function isPathSafe(path: string, worktreeRoot: string): boolean {
  if (path.includes("\0")) return false;
  const resolved = resolve(worktreeRoot, path);
  const root = resolve(worktreeRoot);
  return resolved.startsWith(root + sep) || resolved === root;
}
