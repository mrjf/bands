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
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, statSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";
import type { BandExecResult } from "./types";

const DEFAULT_VM_NAME = "bands-executor";
const SERVER_URL = "http://localhost:9000";
const EXEC_LOCK_DIR = join(tmpdir(), "bands-lima-exec.lock");
const EXEC_LOCK_TIMESTAMP = join(EXEC_LOCK_DIR, "created-at");
const EXEC_LOCK_STALE_MS = 120_000;

export function acquireExecLockSync(timeoutMs = 150_000): () => void {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      mkdirSync(EXEC_LOCK_DIR);
      writeFileSync(EXEC_LOCK_TIMESTAMP, String(Date.now()));
      return () => rmSync(EXEC_LOCK_DIR, { recursive: true, force: true });
    } catch (e: any) {
      if (e?.code !== "EEXIST") throw e;

      try {
        const parsedCreatedAt = Number(readFileSync(EXEC_LOCK_TIMESTAMP, "utf-8"));
        const createdAt = Number.isNaN(parsedCreatedAt)
          ? statSync(EXEC_LOCK_DIR).mtimeMs
          : parsedCreatedAt;
        if (Date.now() - createdAt > EXEC_LOCK_STALE_MS) {
          rmSync(EXEC_LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for exclusive access to the band server");
      }
      const waitUntil = Date.now() + 100;
      while (Date.now() < waitUntil) {}
    }
  }
}

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
  fileRules?: { allowCli: string[]; denyCli: string[]; allowRead: string[]; denyRead?: string[]; allowWrite: string[]; denyWrite?: string[]; insist?: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] } }
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
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse input JSON from ${inputPath}: ${e instanceof Error ? e.message : e}`,
    };
  }

  // Read config if present
  let config: unknown | undefined;
  if (configPath) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch (e) {
      return {
        success: false,
        error: `Failed to parse config JSON from ${configPath}: ${e instanceof Error ? e.message : e}`,
      };
    }
  }

  // Build the execution request
  const execReq = {
    script,
    input,
    config,
    secrets: envSecrets,
    allowNet: networkRules?.allowNet ?? [],
    denyNet: networkRules?.denyNet ?? [],
    allowCli: fileRules?.allowCli ?? [],
    denyCli: fileRules?.denyCli ?? [],
    allowRead: fileRules?.allowRead ?? [],
    denyRead: fileRules?.denyRead ?? [],
    allowWrite: fileRules?.allowWrite ?? [],
    denyWrite: fileRules?.denyWrite ?? [],
    insist: fileRules?.insist,
  };

  // POST to the band server. The Lima server accepts one execution at a time;
  // serialize cross-process callers so parallel test files do not race it.
  let resp: Response;
  let releaseLock: (() => void) | undefined;
  try {
    releaseLock = acquireExecLockSync();
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
  } finally {
    releaseLock?.();
  }

  let result: {
    success: boolean;
    data?: unknown;
    error?: string;
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
  if (/[^a-zA-Z0-9._-]/.test(skillName)) {
    return { success: false, error: `Unsafe skill name for shell interpolation: ${skillName}` };
  }
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

// ── Exports for testing ───────────────────────────────────────────────

// These are now in band-server.ts (runs inside VM), but we re-export
// the builder functions for unit testing.

export { buildBwrapCommand, extractMountPath, buildFirewallScript } from "./lima-exec-utils";
