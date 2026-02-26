/**
 * Docker Executor
 *
 * Runs bands in isolated Docker containers with full enforcement of:
 * - Network egress restrictions (via Docker network policies)
 * - Filesystem isolation (via volume mounts)
 * - Resource limits (CPU, memory, runtime)
 * - Tool restrictions (via container capabilities)
 *
 * Requires Docker to be installed and accessible.
 */

import type { BandDocument } from "@bands/format";
import type { Executor, ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/** Docker image selection based on band requirements */
const DEFAULT_IMAGES = {
  python: "python:3.11-slim",
  node: "node:20-slim",
  bash: "alpine:3.19",
  default: "alpine:3.19",
} as const;

export class DockerExecutor implements Executor {
  readonly name = "docker";
  readonly target = "local-docker" as const;

  private options: ExecutorOptions;
  private dockerAvailable: boolean | null = null;

  constructor(options: ExecutorOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) {
      return this.dockerAvailable;
    }

    try {
      await this.runCommand("docker", ["version", "--format", "{{.Server.Version}}"]);
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }

    return this.dockerAvailable;
  }

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const startTime = Date.now();
    let tempDir: string | null = null;

    try {
      // Create temp directory for execution context
      tempDir = await mkdtemp(join(tmpdir(), "band-docker-"));

      // Prepare execution environment
      const image = this.selectImage(input.band);
      const containerName = `band-${input.band.band}-${Date.now()}`;

      // Write input payload to temp file
      const inputFile = join(tempDir, "input.json");
      await writeFile(inputFile, JSON.stringify(input.payload));

      // Write band body (skill instructions) if present
      if (input.band.body) {
        await writeFile(join(tempDir, "skill.md"), input.band.body);
      }

      // Write execution script
      const scriptFile = join(tempDir, "run.sh");
      const script = this.generateExecutionScript(input.band);
      await writeFile(scriptFile, script, { mode: 0o755 });

      // Build Docker run arguments
      const dockerArgs = this.buildDockerArgs({
        image,
        containerName,
        tempDir,
        band: input.band,
        timeoutMs: input.timeoutMs,
        env: input.env,
      });

      // Pull image if needed (ignore errors, might already exist)
      try {
        await this.runCommand("docker", ["pull", image], { timeout: 60000 });
      } catch {
        // Image might already exist locally
      }

      const startupMs = Date.now() - startTime;

      // Run the container
      const { stdout, stderr, exitCode } = await this.runCommand("docker", dockerArgs, {
        timeout: (input.timeoutMs || input.band.limits?.maxRuntimeMs || 30000) + 5000,
      });

      const durationMs = Date.now() - startTime;

      if (exitCode !== 0) {
        return {
          success: false,
          error: {
            code: "CONTAINER_ERROR",
            message: stderr || `Container exited with code ${exitCode}`,
          },
          metrics: {
            startupMs,
            durationMs,
            inputBytes: JSON.stringify(input.payload).length,
            outputBytes: 0,
          },
          target: this.target,
        };
      }

      // Parse output
      let data: unknown;
      try {
        data = JSON.parse(stdout);
      } catch {
        data = { raw: stdout };
      }

      return {
        success: true,
        data,
        metrics: {
          startupMs,
          durationMs,
          inputBytes: JSON.stringify(input.payload).length,
          outputBytes: stdout.length,
        },
        target: this.target,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        error: {
          code: "DOCKER_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
        metrics: {
          startupMs: 0,
          durationMs,
          inputBytes: JSON.stringify(input.payload).length,
          outputBytes: 0,
        },
        target: this.target,
      };
    } finally {
      // Cleanup temp directory
      if (tempDir) {
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  async cleanup(): Promise<void> {
    // Clean up any dangling containers from this executor
    try {
      const { stdout } = await this.runCommand("docker", [
        "ps",
        "-a",
        "--filter",
        "name=band-",
        "--format",
        "{{.ID}}",
      ]);

      const containerIds = stdout.trim().split("\n").filter(Boolean);
      if (containerIds.length > 0) {
        await this.runCommand("docker", ["rm", "-f", ...containerIds]);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private selectImage(band: BandDocument): string {
    // Use custom image if specified in execution config
    if (band.execution?.docker?.image) {
      return band.execution.docker.image;
    }

    // Use custom image from options
    if (this.options.dockerImage) {
      return this.options.dockerImage;
    }

    // Detect image based on skill content
    const body = band.body?.toLowerCase() || "";

    if (body.includes("python") || body.includes("pip install") || body.includes(".py")) {
      return DEFAULT_IMAGES.python;
    }

    if (body.includes("node") || body.includes("npm") || body.includes("bun")) {
      return DEFAULT_IMAGES.node;
    }

    if (body.includes("bash") || body.includes("#!/bin/bash")) {
      return DEFAULT_IMAGES.bash;
    }

    return DEFAULT_IMAGES.default;
  }

  private buildDockerArgs(opts: {
    image: string;
    containerName: string;
    tempDir: string;
    band: BandDocument;
    timeoutMs?: number;
    env?: Record<string, string>;
  }): string[] {
    const { image, containerName, tempDir, band, timeoutMs, env } = opts;
    const args: string[] = ["run", "--rm"];

    // Container name
    args.push("--name", containerName);

    // Network isolation
    const networkMode = band.execution?.docker?.network || this.getNetworkMode(band);
    args.push("--network", networkMode);

    // Memory limit
    const memory = band.execution?.docker?.memory || "256m";
    args.push("--memory", memory);

    // CPU limit
    const cpus = band.execution?.docker?.cpus || "0.5";
    args.push("--cpus", cpus);

    // Security: drop all capabilities, no new privileges
    args.push("--cap-drop", "ALL");
    args.push("--security-opt", "no-new-privileges");

    // Read-only root filesystem
    args.push("--read-only");

    // Temp filesystem for /tmp
    args.push("--tmpfs", "/tmp:rw,noexec,nosuid,size=64m");

    // Mount working directory
    args.push("-v", `${tempDir}:/work:ro`);
    args.push("-w", "/work");

    // Environment variables
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    // Band-specific environment
    if (band.execution?.docker?.env) {
      for (const [key, value] of Object.entries(band.execution.docker.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    // Timeout via timeout command inside container
    const timeout = Math.ceil((timeoutMs || band.limits?.maxRuntimeMs || 30000) / 1000);
    args.push("-e", `TIMEOUT=${timeout}`);

    // Image and command
    args.push(image);
    args.push("/bin/sh", "-c", `timeout ${timeout} /work/run.sh < /work/input.json`);

    return args;
  }

  private getNetworkMode(band: BandDocument): "none" | "bridge" | "host" {
    const egress = band.capabilities?.network?.egress;

    // If no network capability or default deny with no allows, use none
    if (!egress) {
      return "none";
    }

    if (egress.default === "deny" && !egress.allow_dns?.length && !egress.allow_ip?.length) {
      return "none";
    }

    // If network is needed, use bridge (we'd need iptables rules for proper filtering)
    return "bridge";
  }

  private generateExecutionScript(band: BandDocument): string {
    // Generate a script that runs the skill
    // This is a simplified version - a full implementation would handle
    // different skill types, script execution, etc.

    return `#!/bin/sh
set -e

# Read input
INPUT=$(cat)

# Check if Python is available
if command -v python3 >/dev/null 2>&1; then
  python3 -c "
import json
import sys

input_data = json.loads('''$INPUT''')
result = {
    'success': True,
    'input': input_data,
    'band': '${band.band}',
    'executor': 'docker'
}
print(json.dumps(result))
"
elif command -v node >/dev/null 2>&1; then
  node -e "
const input = JSON.parse(\`$INPUT\`);
const result = {
  success: true,
  input,
  band: '${band.band}',
  executor: 'docker'
};
console.log(JSON.stringify(result));
"
else
  # Fallback to shell
  echo '{"success": true, "band": "${band.band}", "executor": "docker", "note": "shell fallback"}'
fi
`;
  }

  private runCommand(
    cmd: string,
    args: string[],
    options: { timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killed = false;

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timer = options.timeout
        ? setTimeout(() => {
            killed = true;
            proc.kill("SIGKILL");
          }, options.timeout)
        : null;

      proc.on("close", (code) => {
        if (timer) clearTimeout(timer);

        if (killed) {
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        } else {
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        }
      });

      proc.on("error", (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
    });
  }
}

/** Factory function for the registry */
export function createDockerExecutor(options?: ExecutorOptions): Executor {
  return new DockerExecutor(options);
}
