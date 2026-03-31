/**
 * Lima-specific execution for banded skills.
 *
 * Sends execution requests to the band server running inside the Lima VM
 * at http://localhost:9000. The server handles all isolation:
 * - iptables firewall (per-execution, kernel-level)
 * - bubblewrap sandbox (mount namespace, user namespace)
 * - Single-use mutex (rejects concurrent requests)
 *
 * The VM boots locked down (iptables DROP all outbound). Each execution
 * opens exactly what the band declares, runs in bwrap, then resets.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, basename, relative, dirname } from "path";
import { tmpdir } from "os";
import type { BandExecResult } from "./types";
import { isPathAllowed } from "./lima-exec-utils";

const DEFAULT_VM_NAME = "bands-executor";
const SERVER_URL = "http://localhost:9000";

/**
 * Execute a script in the Lima VM via the band server.
 *
 * Reads run.sh, packages it with input/config/secrets/rules,
 * and POSTs to the server. One HTTP call replaces 5+ SSH calls.
 */
export async function limaExec(
  runShPath: string,
  resourceDir: string,
  inputPath: string,
  outputPath: string,
  vmName: string = DEFAULT_VM_NAME,
  envSecrets: Record<string, string> = {},
  skillRoot?: string,
  configPath?: string,
  networkRules?: { allowNet: string[]; denyNet: string[] },
  fileRules?: { allowCli: string[]; denyCli: string[]; allowRead: string[]; denyRead: string[]; allowWrite: string[]; denyWrite: string[]; insist?: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] }; maxInputBytes?: number; maxOutputBytes?: number }
): Promise<BandExecResult> {
  const startTime = Date.now();

  // Run skill-level setup.sh if present and not already done
  if (skillRoot) {
    const setupResult = runSkillSetup(skillRoot, vmName);
    if (!setupResult.success) {
      return setupResult;
    }
  }

  // Read script and input
  const script = readFileSync(runShPath, "utf-8");
  const inputContent = readFileSync(inputPath, "utf-8");
  let input: unknown;
  try {
    input = JSON.parse(inputContent);
  } catch {
    input = {};
  }

  // Read config if present
  let config: unknown | undefined;
  if (configPath) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch { /* skip */ }
  }

  // Stage allowed read files (copy-in): resolve allow.read patterns,
  // exclude deny.read matches, read file contents
  const allowRead = fileRules?.allowRead ?? [];
  const denyRead = fileRules?.denyRead ?? [];
  const allowWrite = fileRules?.allowWrite ?? [];
  const denyWrite = fileRules?.denyWrite ?? [];
  let files: Record<string, string> | undefined;
  if (allowRead.length > 0) {
    files = resolveFiles(allowRead, denyRead);
  } else if (allowWrite.length > 0) {
    files = {}; // Empty files map — triggers files dir creation + output collection
  }

  // Build the execution request
  const execReq = {
    script,
    input,
    config,
    secrets: envSecrets,
    files,
    allowNet: networkRules?.allowNet ?? [],
    denyNet: networkRules?.denyNet ?? [],
    allowCli: fileRules?.allowCli ?? [],
    denyCli: fileRules?.denyCli ?? [],
    allowRead,
    allowWrite,
    insist: fileRules?.insist,
    maxInputBytes: fileRules?.maxInputBytes,
    maxOutputBytes: fileRules?.maxOutputBytes,
  };

  // POST to the band server
  let resp: Response;
  try {
    resp = await fetch(`${SERVER_URL}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(execReq),
      signal: AbortSignal.timeout(65000), // slightly longer than server's 60s timeout
    });
  } catch (e: any) {
    return {
      success: false,
      error: `Failed to reach band server at ${SERVER_URL}: ${e.message}. Is the Lima VM running?`,
    };
  }

  let result: {
    success: boolean;
    data?: unknown;
    error?: string;
    outputFiles?: Record<string, string>;
    metrics?: { durationMs: number; inputBytes: number; outputBytes: number };
  };
  try {
    result = await resp.json();
  } catch {
    const text = await resp.text().catch(() => "");
    return {
      success: false,
      error: `Band server returned invalid JSON (HTTP ${resp.status}). Response: ${text.slice(0, 200)}. Is the band server up to date?`,
    };
  }

  // Write back output files (copy-out): only files matching allow.write
  // and not matching deny.write are written to the host filesystem.
  // Output file keys are relative paths from the files dir — prepend /
  // to reconstruct the absolute host path for pattern matching.
  if (result.outputFiles && allowWrite.length > 0) {
    for (const [relPath, content] of Object.entries(result.outputFiles)) {
      const absPath = relPath.startsWith("/") ? relPath : `/${relPath}`;
      if (isPathAllowed(absPath, allowWrite, denyWrite)) {
        const dir = dirname(absPath);
        if (dir && dir !== "/" && dir !== ".") {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(absPath, content);
      }
    }
  }

  // Write output to host output path
  if (result.data !== undefined) {
    writeFileSync(
      outputPath,
      typeof result.data === "string"
        ? result.data
        : JSON.stringify(result.data, null, 2)
    );
  }

  return {
    success: result.success,
    data: result.data,
    error: result.error,
    metrics: result.metrics ?? {
      durationMs: Date.now() - startTime,
      inputBytes: inputContent.length,
      outputBytes: result.data ? JSON.stringify(result.data).length : 0,
    },
  };
}

// ── Skill setup ───────────────────────────────────────────────────────

/**
 * Run a skill's setup.sh in the VM if it hasn't been run yet.
 * Uses a marker file in the VM to track completion.
 *
 * Note: setup.sh runs OUTSIDE the sandbox (as the host user via limactl)
 * because it needs to install system packages, configure tools, etc.
 */
function runSkillSetup(
  skillRoot: string,
  vmName: string
): { success: true } | BandExecResult {
  const setupPath = join(skillRoot, "setup.sh");
  if (!existsSync(setupPath)) {
    return { success: true };
  }

  const skillName = basename(skillRoot);
  const markerPath = `/tmp/.band-setup-done-${skillName}`;

  // Check if setup already ran
  try {
    execSync(`limactl shell ${vmName} -- test -f ${markerPath}`, {
      stdio: "pipe",
    });
    return { success: true };
  } catch {
    // Marker doesn't exist — need to run setup
  }

  const stagingDir = mkdtempSync(join(tmpdir(), "lima-band-setup-"));
  try {
    const setupContent = readFileSync(setupPath, "utf-8");
    const stagingSetupPath = join(stagingDir, "setup.sh");
    writeFileSync(stagingSetupPath, setupContent);

    const vmSetupDir = `/tmp/band-setup-${skillName}`;
    execSync(`limactl shell ${vmName} -- mkdir -p ${vmSetupDir}`, { stdio: "pipe" });
    execSync(`limactl copy ${stagingSetupPath} ${vmName}:${vmSetupDir}/setup.sh`, { stdio: "pipe" });
    execSync(`limactl shell ${vmName} -- bash ${vmSetupDir}/setup.sh`, {
      stdio: "pipe",
      timeout: 300000,
    });

    execSync(`limactl shell ${vmName} -- touch ${markerPath}`, { stdio: "pipe" });
    execSync(`limactl shell ${vmName} -- rm -rf ${vmSetupDir}`, { stdio: "pipe" });

    return { success: true };
  } catch (e: any) {
    const stderr = e.stderr?.toString() || "";
    const stdout = e.stdout?.toString() || "";
    return {
      success: false,
      error: `Skill setup failed: ${stderr || stdout || (e instanceof Error ? e.message : String(e))}`,
    };
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

// ── File resolution ───────────────────────────────────────────────────

/**
 * Resolve allow.read glob patterns to actual files on the host filesystem.
 * Excludes files matching any deny.read pattern.
 * Returns a map of relative path → file content.
 */
function resolveFiles(
  allowPatterns: string[],
  denyPatterns: string[]
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const pattern of allowPatterns) {
    // Extract the concrete directory prefix from the glob
    const globIdx = pattern.search(/[*?{[]/);
    const dir = globIdx === -1 ? dirname(pattern) : pattern.slice(0, pattern.lastIndexOf("/", globIdx));

    if (!dir || !existsSync(dir)) continue;

    if (globIdx === -1) {
      // Exact file path
      if (existsSync(pattern) && statSync(pattern).isFile()) {
        if (isPathAllowed(pattern, allowPatterns, denyPatterns)) {
          try {
            files[pattern] = readFileSync(pattern, "utf-8");
          } catch { /* skip binary/unreadable files */ }
        }
      }
    } else {
      // Glob — walk the directory
      walkDir(dir, (filePath) => {
        if (isPathAllowed(filePath, allowPatterns, denyPatterns)) {
          try {
            files[filePath] = readFileSync(filePath, "utf-8");
          } catch { /* skip binary/unreadable files */ }
        }
      });
    }
  }

  return files;
}

/**
 * Recursively walk a directory, calling fn for each file.
 */
function walkDir(dir: string, fn: (path: string) => void): void {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath, fn);
      } else if (entry.isFile()) {
        fn(fullPath);
      }
    }
  } catch { /* permission denied, etc */ }
}

// ── Exports for testing ───────────────────────────────────────────────

// These are now in band-server.ts (runs inside VM), but we re-export
// the builder functions for unit testing.

export { buildBwrapCommand, extractMountPath, buildFirewallScript } from "./lima-exec-utils";
