/**
 * Lima-specific execution for banded skills.
 *
 * Uses limactl copy (files in/out) + limactl shell (run script)
 * instead of the HTTP-based Lima executor. This avoids needing
 * the band-server running in the VM for simple script execution.
 */

import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";
import type { BandExecResult } from "./types";

const DEFAULT_VM_NAME = "bands-executor";

/**
 * Execute a script in a Lima VM.
 *
 * 1. limactl copy staging dir into VM
 * 2. limactl shell to run run.sh with args
 * 3. limactl copy output back to host
 */
export async function limaExec(
  runShPath: string,
  resourceDir: string,
  inputPath: string,
  outputPath: string,
  vmName: string = DEFAULT_VM_NAME,
  envSecrets: Record<string, string> = {},
  skillRoot?: string
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

  // Run skill-level setup.sh if present and not already done
  if (skillRoot) {
    const setupResult = runSkillSetup(skillRoot, vmName);
    if (!setupResult.success) {
      return setupResult;
    }
  }

  // Create a staging directory with everything needed
  const stagingDir = mkdtempSync(join(tmpdir(), "lima-band-exec-"));

  try {
    const vmWorkdir = `/tmp/band-exec-${randomUUID()}`;
    const vmInputPath = `${vmWorkdir}/input.json`;
    const vmOutputPath = `${vmWorkdir}/output.json`;

    // Copy resource directory contents to staging
    const resourceName = basename(resourceDir);

    // Copy input to staging
    const stagingInputPath = join(stagingDir, "input.json");
    const inputContent = readFileSync(inputPath, "utf-8");
    writeFileSync(stagingInputPath, inputContent);

    // Copy run.sh to staging
    const runShContent = readFileSync(runShPath, "utf-8");
    writeFileSync(join(stagingDir, "run.sh"), runShContent);

    // Write env file with secrets and standard vars
    const envLines = [
      `export INPUT_PATH=${vmInputPath}`,
      `export OUTPUT_PATH=${vmOutputPath}`,
    ];
    for (const [key, value] of Object.entries(envSecrets)) {
      // Base64-encode to avoid any shell quoting issues
      const b64 = Buffer.from(value).toString("base64");
      envLines.push(`export ${key}=$(echo '${b64}' | base64 -d)`);
    }
    writeFileSync(join(stagingDir, "env.sh"), envLines.join("\n") + "\n");

    // Copy staging dir into VM
    try {
      execSync(`limactl shell ${vmName} -- mkdir -p ${vmWorkdir}`, {
        stdio: "pipe",
      });
      execSync(
        `limactl copy ${stagingDir}/run.sh ${vmName}:${vmWorkdir}/run.sh`,
        { stdio: "pipe" }
      );
      execSync(
        `limactl copy ${stagingDir}/env.sh ${vmName}:${vmWorkdir}/env.sh`,
        { stdio: "pipe" }
      );
      execSync(
        `limactl copy ${stagingInputPath} ${vmName}:${vmInputPath}`,
        { stdio: "pipe" }
      );
    } catch (e) {
      return {
        success: false,
        error: `Failed to copy files to VM: ${e instanceof Error ? e.message : e}`,
      };
    }

    // Run the script in the VM (source env.sh for secrets + paths, then run)
    let stdout: string;
    let stderr: string;
    try {
      const result = execSync(
        `limactl shell ${vmName} -- bash -c 'source ${vmWorkdir}/env.sh && bash ${vmWorkdir}/run.sh'`,
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
        return {
          success: false,
          error: errorMessage || `Script exited with code ${e.status}`,
        };
      }
    }

    // Copy output back from VM
    let outputData: unknown;
    try {
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

    // Cleanup in VM
    try {
      execSync(`limactl shell ${vmName} -- rm -rf ${vmWorkdir}`, {
        stdio: "pipe",
      });
    } catch {
      // Best effort cleanup
    }

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

  // Use a hash of the skill root as the marker name
  const skillName = basename(skillRoot);
  const markerPath = `/tmp/.band-setup-done-${skillName}`;

  // Check if setup already ran
  try {
    execSync(`limactl shell ${vmName} -- test -f ${markerPath}`, {
      stdio: "pipe",
    });
    return { success: true }; // Already set up
  } catch {
    // Marker doesn't exist — need to run setup
  }

  // Copy and run setup.sh
  const stagingDir = mkdtempSync(join(tmpdir(), "lima-band-setup-"));
  try {
    const setupContent = readFileSync(setupPath, "utf-8");
    const stagingSetupPath = join(stagingDir, "setup.sh");
    writeFileSync(stagingSetupPath, setupContent);

    const vmSetupDir = `/tmp/band-setup-${skillName}`;
    execSync(`limactl shell ${vmName} -- mkdir -p ${vmSetupDir}`, {
      stdio: "pipe",
    });
    execSync(
      `limactl copy ${stagingSetupPath} ${vmName}:${vmSetupDir}/setup.sh`,
      { stdio: "pipe" }
    );

    execSync(
      `limactl shell ${vmName} -- bash ${vmSetupDir}/setup.sh`,
      { stdio: "pipe", timeout: 300000 } // 5 min timeout for installs
    );

    // Mark as done
    execSync(`limactl shell ${vmName} -- touch ${markerPath}`, {
      stdio: "pipe",
    });

    // Cleanup setup dir
    execSync(`limactl shell ${vmName} -- rm -rf ${vmSetupDir}`, {
      stdio: "pipe",
    });

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
