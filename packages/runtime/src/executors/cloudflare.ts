/**
 * Cloudflare Executor
 *
 * Runs bands in Cloudflare Containers (Docker containers on Cloudflare's
 * network, backed by Durable Objects). Uses the same band server as the
 * Lima executor — identical permission enforcement, CLI execution, file
 * I/O, and networking.
 *
 * Architecture:
 *   wrangler deploy → Worker proxy → Container (Docker) → bun server.ts (port 9000)
 *
 * The Worker is a thin proxy that routes requests to a persistent container.
 * The container runs the same Hono server as Lima with full capabilities.
 *
 * Requires:
 * - Cloudflare credentials (API token + account ID)
 * - Docker running locally (for container image builds during deploy)
 * - wrangler CLI installed
 */

import type { BandDocument } from "@bands/format";
import type { Executor, ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";
import { spawn } from "child_process";

export class CloudflareExecutor implements Executor {
  readonly name = "cloudflare";
  readonly target = "cloudflare" as const;

  private options: ExecutorOptions;
  private wranglerAvailable: boolean | null = null;
  private deployedWorkers = new Map<string, string>(); // band name -> worker URL
  private initializedBands = new Set<string>(); // worker URLs that have been /init'd

  constructor(options: ExecutorOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    if (this.wranglerAvailable !== null) {
      return this.wranglerAvailable;
    }

    try {
      // Check if wrangler is installed
      await this.runCommand("wrangler", ["--version"]);

      // Check if Docker is available (required for container image builds)
      await this.runCommand("docker", ["info"], { timeout: 5000 });

      // Check if API token is configured
      const hasToken = !!(
        this.options.cloudflareToken ||
        process.env.CLOUDFLARE_API_TOKEN ||
        process.env.CF_API_TOKEN
      );

      // Check if account ID is configured
      const hasAccountId = !!(
        this.options.cloudflareAccountId ||
        process.env.CLOUDFLARE_ACCOUNT_ID ||
        process.env.CF_ACCOUNT_ID
      );

      this.wranglerAvailable = hasToken && hasAccountId;
    } catch {
      this.wranglerAvailable = false;
    }

    return this.wranglerAvailable;
  }

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const startTime = Date.now();

    try {
      // Get or deploy the container worker
      const workerUrl = await this.getOrDeployWorker(input.band);
      const startupMs = Date.now() - startTime;

      // Initialize with band config (stateful — container persists across requests)
      if (!this.initializedBands.has(workerUrl)) {
        const initResp = await fetch(`${workerUrl}/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.band),
        });

        if (!initResp.ok) {
          throw new Error(`Init failed: ${await initResp.text()}`);
        }

        this.initializedBands.add(workerUrl);
      }

      // Execute — same pattern as Lima
      const execResp = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(input.payload),
      });

      const durationMs = Date.now() - startTime;
      const responseText = await execResp.text();

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Container returned non-JSON response (${execResp.status}): ${responseText.slice(0, 500)}`);
      }

      if (!execResp.ok) {
        const errorResp = data as { error?: { code?: string; message?: string } };
        return {
          success: false,
          error: {
            code: errorResp.error?.code || "CONTAINER_ERROR",
            message: errorResp.error?.message || "Container execution failed",
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

      return {
        success: true,
        data,
        metrics: {
          startupMs,
          durationMs,
          inputBytes: JSON.stringify(input.payload).length,
          outputBytes: responseText.length,
        },
        target: this.target,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        error: {
          code: "CLOUDFLARE_ERROR",
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
    }
  }

  async cleanup(): Promise<void> {
    this.deployedWorkers.clear();
    this.initializedBands.clear();
  }

  private async getOrDeployWorker(band: BandDocument): Promise<string> {
    const workerName = band.execution?.cloudflare?.workerName || `band-${band.band}`;

    // Check cache
    const cached = this.deployedWorkers.get(workerName);
    if (cached) {
      return cached;
    }

    // Check if worker already exists and is healthy
    const existingUrl = await this.checkWorkerExists(workerName);
    if (existingUrl) {
      this.deployedWorkers.set(workerName, existingUrl);
      return existingUrl;
    }

    // Deploy new container worker
    const deployedUrl = await this.deployWorker(workerName);
    this.deployedWorkers.set(workerName, deployedUrl);
    return deployedUrl;
  }

  private async checkWorkerExists(workerName: string): Promise<string | null> {
    const url = `https://${workerName}.workers.dev`;
    try {
      const response = await fetch(`${url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return url;
      }
    } catch {
      // Not deployed
    }
    return null;
  }

  private async deployWorker(workerName: string): Promise<string> {
    const workerDir = await this.createWorkerBundle(workerName);

    try {
      const { stdout, stderr, exitCode } = await this.runCommand(
        "wrangler",
        ["deploy", "--name", workerName],
        { cwd: workerDir, timeout: 300000 } // 5 min — container builds take longer
      );

      if (exitCode !== 0) {
        throw new Error(`Wrangler deploy failed: ${stderr}`);
      }

      // Parse deployed URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+\.workers\.dev/);
      if (urlMatch) {
        return urlMatch[0];
      }

      return `https://${workerName}.workers.dev`;
    } finally {
      try {
        const { rm } = await import("fs/promises");
        await rm(workerDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async createWorkerBundle(workerName: string): Promise<string> {
    const { mkdtemp, writeFile, copyFile } = await import("fs/promises");
    const { join, resolve } = await import("path");
    const { tmpdir } = await import("os");

    const tempDir = await mkdtemp(join(tmpdir(), "band-cf-"));

    // Copy container files from the cloudflare-container directory
    const containerDir = resolve(__dirname, "cloudflare-container");

    await Promise.all([
      copyFile(join(containerDir, "worker.ts"), join(tempDir, "worker.ts")),
      copyFile(join(containerDir, "server.ts"), join(tempDir, "server.ts")),
      copyFile(join(containerDir, "Dockerfile"), join(tempDir, "Dockerfile")),
    ]);

    // Generate wrangler.toml
    const wranglerConfig = `\
name = "${workerName}"
main = "worker.ts"
compatibility_date = "2024-01-01"

[[containers]]
class_name = "BandContainer"
image = "./Dockerfile"
max_instances = 10

[[durable_objects.bindings]]
name = "BAND_CONTAINER"
class_name = "BandContainer"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["BandContainer"]
`;

    await writeFile(join(tempDir, "wrangler.toml"), wranglerConfig);

    return tempDir;
  }

  private runCommand(
    cmd: string,
    args: string[],
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: options.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: this.options.cloudflareToken || process.env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: this.options.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID,
          CI: "true",
        },
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
export function createCloudflareExecutor(options?: ExecutorOptions): Executor {
  return new CloudflareExecutor(options);
}
