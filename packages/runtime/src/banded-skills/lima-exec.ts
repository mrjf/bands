/**
 * Lima-specific execution for banded skills.
 *
 * Uses limactl copy (files in/out) + limactl shell (run script)
 * instead of the HTTP-based Lima executor.
 *
 * Security layers:
 * - User separation: scripts run as `band-runner` (unprivileged)
 * - Network isolation: iptables REJECT rules from allow.net config
 * - Secrets isolation: env file readable only by band-runner, cleaned up after
 * - Workdir isolation: per-execution dir with 700 permissions
 */

import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";
import type { BandExecResult } from "./types";

const DEFAULT_VM_NAME = "bands-executor";
const BAND_RUNNER_USER = "band-runner";

/**
 * Execute a script in a Lima VM with isolation.
 *
 * 1. Ensure band-runner user exists in VM
 * 2. Create workdir owned by band-runner
 * 3. Copy files into VM workdir
 * 4. Set up iptables firewall rules
 * 5. Run script as band-runner
 * 6. Tear down firewall and clean up
 * 7. Copy output back to host
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
  networkRules?: { allowNet: string[]; denyNet: string[] }
): Promise<BandExecResult> {
  const startTime = Date.now();

  // Check limactl is available
  try {
    execSync("limactl --version", { stdio: "pipe" });
  } catch {
    return {
      success: false,
      error: "limactl is not installed or not on PATH",
    };
  }

  // Ensure band-runner user exists in VM
  ensureBandRunnerUser(vmName);

  // Run skill-level setup.sh if present and not already done
  if (skillRoot) {
    const setupResult = runSkillSetup(skillRoot, vmName);
    if (!setupResult.success) {
      return setupResult;
    }
  }

  // Create a staging directory with everything needed
  const stagingDir = mkdtempSync(join(tmpdir(), "lima-band-exec-"));

  // Unique chain name for this execution (iptables chain names max 28 chars)
  const execId = randomUUID().slice(0, 8);
  const chainName = `BAND-${execId}`;

  try {
    const vmWorkdir = `/tmp/band-exec-${randomUUID()}`;
    const vmInputPath = `${vmWorkdir}/input.json`;
    const vmOutputPath = `${vmWorkdir}/output.json`;

    // Copy input to staging
    const stagingInputPath = join(stagingDir, "input.json");
    const inputContent = readFileSync(inputPath, "utf-8");
    writeFileSync(stagingInputPath, inputContent);

    // Copy run.sh to staging
    const runShContent = readFileSync(runShPath, "utf-8");
    writeFileSync(join(stagingDir, "run.sh"), runShContent);

    // Stage config.json if present
    if (configPath) {
      const configContent = readFileSync(configPath, "utf-8");
      writeFileSync(join(stagingDir, "config.json"), configContent);
    }

    // Write env file with secrets and standard vars
    const vmConfigPath = `${vmWorkdir}/config.json`;
    const envLines = [
      `export INPUT_PATH=${vmInputPath}`,
      `export OUTPUT_PATH=${vmOutputPath}`,
    ];
    if (configPath) {
      envLines.push(`export CONFIG_PATH=${vmConfigPath}`);
    }
    for (const [key, value] of Object.entries(envSecrets)) {
      // Base64-encode to avoid any shell quoting issues
      const b64 = Buffer.from(value).toString("base64");
      envLines.push(`export ${key}=$(echo '${b64}' | base64 -d)`);
    }
    writeFileSync(join(stagingDir, "env.sh"), envLines.join("\n") + "\n");

    // Create workdir in VM owned by band-runner with strict permissions
    // Files are only readable by band-runner — not by other users or processes
    try {
      limaShell(vmName, `sudo mkdir -p ${vmWorkdir}`);
      limaShell(vmName, `sudo chown ${BAND_RUNNER_USER}:${BAND_RUNNER_USER} ${vmWorkdir}`);
      limaShell(vmName, `sudo chmod 700 ${vmWorkdir}`);

      // Copy files to a temp location first (limactl copy runs as host user),
      // then move into the restricted workdir
      const vmStagingDir = `/tmp/band-staging-${execId}`;
      limaShell(vmName, `mkdir -p ${vmStagingDir}`);

      execSync(`limactl copy ${stagingDir}/run.sh ${vmName}:${vmStagingDir}/run.sh`, { stdio: "pipe" });
      execSync(`limactl copy ${stagingDir}/env.sh ${vmName}:${vmStagingDir}/env.sh`, { stdio: "pipe" });
      execSync(`limactl copy ${stagingInputPath} ${vmName}:${vmStagingDir}/input.json`, { stdio: "pipe" });
      if (configPath) {
        execSync(`limactl copy ${join(stagingDir, "config.json")} ${vmName}:${vmStagingDir}/config.json`, { stdio: "pipe" });
      }

      // Move files into restricted workdir and set ownership
      limaShell(vmName, `sudo mv ${vmStagingDir}/* ${vmWorkdir}/`);
      limaShell(vmName, `sudo chown -R ${BAND_RUNNER_USER}:${BAND_RUNNER_USER} ${vmWorkdir}`);
      limaShell(vmName, `sudo chmod 600 ${vmWorkdir}/env.sh`); // secrets file extra-restricted
      limaShell(vmName, `rm -rf ${vmStagingDir}`);
    } catch (e) {
      return {
        success: false,
        error: `Failed to copy files to VM: ${e instanceof Error ? e.message : e}`,
      };
    }

    // Set up iptables firewall rules before running the script
    const firewallScript = buildFirewallScript(chainName, networkRules);
    if (firewallScript) {
      try {
        execSync(
          `limactl shell ${vmName} -- sudo bash -c '${escapeSingleQuotes(firewallScript)}'`,
          { stdio: "pipe", timeout: 30000 }
        );
      } catch (e: any) {
        teardownFirewall(vmName, chainName);
        cleanupVmWorkdir(vmName, vmWorkdir);
        const stderr = e.stderr?.toString() || "";
        return {
          success: false,
          error: `Failed to set up network firewall: ${stderr || (e instanceof Error ? e.message : e)}`,
        };
      }
    }

    // Run the script as band-runner (unprivileged user)
    let stdout: string;
    let stderr: string;
    try {
      const result = execSync(
        `limactl shell ${vmName} -- sudo -u ${BAND_RUNNER_USER} bash -c 'source ${vmWorkdir}/env.sh && bash ${vmWorkdir}/run.sh'`,
        { stdio: "pipe", timeout: 60000 }
      );
      stdout = result.toString();
      stderr = "";
    } catch (e: any) {
      stderr = e.stderr?.toString() || "";
      stdout = e.stdout?.toString() || "";

      if (e.status !== 0) {
        // Try to read error from output file in VM
        let errorMessage = stderr || stdout;
        try {
          const localErrPath = join(stagingDir, "error-output.json");
          execSync(
            `limactl copy ${vmName}:${vmOutputPath} ${localErrPath}`,
            { stdio: "pipe" }
          );
          const errContent = readFileSync(localErrPath, "utf-8").trim();
          if (errContent) {
            try {
              const parsed = JSON.parse(errContent);
              if (parsed.error) errorMessage = parsed.error;
            } catch {
              const match = errContent.match(/"error"\s*:\s*"(.+)/s);
              errorMessage = match ? match[1].replace(/"\s*}\s*$/, "") : errContent;
            }
          }
        } catch {
          // Output file doesn't exist in VM
        }

        if (firewallScript) teardownFirewall(vmName, chainName);
        cleanupVmWorkdir(vmName, vmWorkdir);

        return {
          success: false,
          error: errorMessage || `Script exited with code ${e.status}`,
        };
      }
    }

    // Tear down firewall rules
    if (firewallScript) teardownFirewall(vmName, chainName);

    // Copy output back from VM (need to relax dir perms since band-runner owns it)
    let outputData: unknown;
    try {
      // Temporarily open the workdir so limactl copy (as host user) can access
      limaShell(vmName, `sudo chmod 755 ${vmWorkdir} 2>/dev/null || true`);
      limaShell(vmName, `sudo chmod 644 ${vmOutputPath} 2>/dev/null || true`);
      const localOutputPath = join(stagingDir, "output.json");
      execSync(
        `limactl copy ${vmName}:${vmOutputPath} ${localOutputPath}`,
        { stdio: "pipe" }
      );

      if (existsSync(localOutputPath)) {
        const content = readFileSync(localOutputPath, "utf-8");
        try {
          outputData = JSON.parse(content);
        } catch {
          outputData = content;
        }
      }
    } catch {
      // Output file may not exist if script wrote to stdout
      if (stdout.trim()) {
        try {
          outputData = JSON.parse(stdout.trim());
        } catch {
          outputData = stdout.trim();
        }
      }
    }

    // Write output to host output path
    if (outputData !== undefined) {
      writeFileSync(
        outputPath,
        typeof outputData === "string"
          ? outputData
          : JSON.stringify(outputData, null, 2)
      );
    }

    // Cleanup workdir in VM (as root since band-runner owns it)
    cleanupVmWorkdir(vmName, vmWorkdir);

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      data: outputData,
      metrics: {
        durationMs,
        inputBytes: inputContent.length,
        outputBytes: outputData ? JSON.stringify(outputData).length : 0,
      },
    };
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

// ── VM helpers ────────────────────────────────────────────────────────

function limaShell(vmName: string, cmd: string): string {
  return execSync(`limactl shell ${vmName} -- bash -c '${escapeSingleQuotes(cmd)}'`, {
    stdio: "pipe",
    encoding: "utf-8",
  });
}

function cleanupVmWorkdir(vmName: string, vmWorkdir: string): void {
  try {
    limaShell(vmName, `sudo rm -rf ${vmWorkdir}`);
  } catch {
    // Best effort
  }
}

// ── User setup ────────────────────────────────────────────────────────

let bandRunnerCreated = false;

/**
 * Ensure the band-runner user exists in the VM.
 * Called once per process — idempotent.
 */
function ensureBandRunnerUser(vmName: string): void {
  if (bandRunnerCreated) return;
  try {
    limaShell(vmName, `id ${BAND_RUNNER_USER}`);
    bandRunnerCreated = true;
    return;
  } catch {
    // User doesn't exist — create it
  }

  try {
    limaShell(
      vmName,
      `sudo useradd --system --no-create-home --shell /usr/sbin/nologin ${BAND_RUNNER_USER}`
    );
    bandRunnerCreated = true;
  } catch (e: any) {
    // May race with concurrent executions — check again
    try {
      limaShell(vmName, `id ${BAND_RUNNER_USER}`);
      bandRunnerCreated = true;
    } catch {
      throw new Error(`Failed to create ${BAND_RUNNER_USER} user: ${e.stderr?.toString() || e.message}`);
    }
  }
}

/** Reset the cached flag (for testing). */
export function resetBandRunnerCache(): void {
  bandRunnerCreated = false;
}

// ── Firewall ──────────────────────────────────────────────────────────

/**
 * Build an iptables setup script for the given network rules.
 *
 * Creates a custom chain with:
 * - ACCEPT for loopback (localhost)
 * - ACCEPT for established/related connections
 * - ACCEPT for DNS (port 53) so host resolution works
 * - ACCEPT for each resolved IP from allow.net entries
 * - REJECT everything else (fast failure with ICMP unreachable)
 *
 * Returns null if no network rules are defined (no restriction).
 */
export function buildFirewallScript(
  chainName: string,
  rules?: { allowNet: string[]; denyNet: string[] }
): string | null {
  // No rules = no restrictions
  if (!rules || rules.allowNet.length === 0) return null;

  const lines: string[] = [
    // Create custom chain
    `iptables -N ${chainName} 2>/dev/null || iptables -F ${chainName}`,

    // Allow loopback
    `iptables -A ${chainName} -o lo -j ACCEPT`,

    // Allow established/related (return traffic for allowed connections)
    `iptables -A ${chainName} -m state --state ESTABLISHED,RELATED -j ACCEPT`,

    // Allow DNS resolution (UDP and TCP port 53)
    `iptables -A ${chainName} -p udp --dport 53 -j ACCEPT`,
    `iptables -A ${chainName} -p tcp --dport 53 -j ACCEPT`,
  ];

  // Resolve each allowed host to IPs and add ACCEPT rules
  for (const host of rules.allowNet) {
    if (host === "*") {
      // Wildcard = allow everything, no point adding rules
      return null;
    }

    if (host.startsWith("*.")) {
      // Wildcard subdomain (e.g., *.github.com)
      const baseDomain = host.slice(2);
      lines.push(
        `# Allow ${host}`,
        `for ip in $(getent ahosts "${baseDomain}" 2>/dev/null | awk '{print $1}' | sort -u); do`,
        `  iptables -A ${chainName} -d "$ip" -j ACCEPT`,
        `done`,
      );
      for (const prefix of ["api", "www"]) {
        lines.push(
          `for ip in $(getent ahosts "${prefix}.${baseDomain}" 2>/dev/null | awk '{print $1}' | sort -u); do`,
          `  iptables -A ${chainName} -d "$ip" -j ACCEPT`,
          `done`,
        );
      }
    } else {
      // Exact hostname or IP
      lines.push(
        `# Allow ${host}`,
        `for ip in $(getent ahosts "${host}" 2>/dev/null | awk '{print $1}' | sort -u); do`,
        `  iptables -A ${chainName} -d "$ip" -j ACCEPT`,
        `done`,
      );
    }
  }

  // Default: REJECT everything else (fast failure with ICMP unreachable)
  lines.push(`iptables -A ${chainName} -j REJECT`);

  // Insert chain into OUTPUT (outbound traffic from the VM)
  lines.push(`iptables -I OUTPUT 1 -m state --state NEW -j ${chainName}`);

  return lines.join("\n");
}

/**
 * Tear down iptables rules for a given execution chain.
 */
function teardownFirewall(vmName: string, chainName: string): void {
  try {
    execSync(
      `limactl shell ${vmName} -- sudo bash -c '` +
        `iptables -D OUTPUT -m state --state NEW -j ${chainName} 2>/dev/null; ` +
        `iptables -F ${chainName} 2>/dev/null; ` +
        `iptables -X ${chainName} 2>/dev/null'`,
      { stdio: "pipe", timeout: 10000 }
    );
  } catch {
    // Best effort
  }
}

/**
 * Escape single quotes for embedding in bash -c '...' strings.
 */
function escapeSingleQuotes(s: string): string {
  return s.replace(/'/g, "'\\''");
}

// ── Skill setup ───────────────────────────────────────────────────────

/**
 * Run a skill's setup.sh in the VM if it hasn't been run yet.
 * Uses a marker file in the VM to track completion.
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
