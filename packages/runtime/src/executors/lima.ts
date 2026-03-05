/**
 * Lima Executor
 *
 * Runs bands in a persistent Lima VM on macOS.
 * The VM runs the @bands/server which enforces band restrictions.
 *
 * Benefits:
 * - VM boot cost paid once, not per-request
 * - Same HTTP interface as Cloudflare executor
 * - Strong isolation (full Linux VM)
 * - Works on macOS via Virtualization.framework
 */

import type { BandDocument } from "@bands/format";
import type { Executor, ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";
import { execSync } from "child_process";
import { setupLima } from "../setup";

const DEFAULT_VM_NAME = "bands-executor";
const DEFAULT_PORT = 9000;

export class LimaExecutor implements Executor {
  readonly name = "lima";
  readonly target = "lima" as const;

  private options: ExecutorOptions;
  private vmReady = false;
  private vmUrl: string | null = null;

  constructor(options: ExecutorOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if limactl is installed
      execSync("limactl --version", { stdio: "pipe" });

      // Check if our VM exists and is running
      const vmName = this.options.limaVmName ?? DEFAULT_VM_NAME;
      const result = execSync("limactl list --json", { stdio: "pipe" }).toString();
      const parsed = JSON.parse(result);
      // limactl returns a single object when there's one VM, array when multiple
      const vms = Array.isArray(parsed) ? parsed : [parsed];
      const vm = vms.find((v: { name: string; status: string }) => v.name === vmName);

      // Only available if VM exists and is running
      // Creating/starting a VM takes too long for test availability checks
      if (!vm || vm.status !== "Running") {
        return false;
      }

      // Check if the band server is responding
      const port = this.options.limaPort ?? DEFAULT_PORT;
      try {
        const resp = await fetch(`http://localhost:${port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        return resp.ok;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  async ensureVmRunning(): Promise<string> {
    if (this.vmReady && this.vmUrl) {
      return this.vmUrl;
    }

    const vmName = this.options.limaVmName ?? DEFAULT_VM_NAME;
    const port = this.options.limaPort ?? DEFAULT_PORT;

    // Check if VM exists
    try {
      const status = execSync(`limactl list --json`, { stdio: "pipe" }).toString();
      const parsed = JSON.parse(status);
      // limactl returns a single object when there's one VM, array when multiple
      const vms = Array.isArray(parsed) ? parsed : [parsed];
      const vm = vms.find((v: any) => v.name === vmName);

      if (!vm) {
        // Create VM
        await this.createVm(vmName, port);
      } else if (vm.status !== "Running") {
        // Start VM
        execSync(`limactl start ${vmName}`, { stdio: "pipe" });
      }
    } catch (err) {
      throw new Error(`Failed to ensure Lima VM: ${err instanceof Error ? err.message : err}`);
    }

    // Wait for band server to be ready
    this.vmUrl = `http://localhost:${port}`;
    await this.waitForServer(this.vmUrl);
    this.vmReady = true;

    return this.vmUrl;
  }

  private async createVm(_vmName: string, _port: number): Promise<void> {
    await setupLima();
  }

  private async waitForServer(url: string, maxWaitMs = 60000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      try {
        const resp = await fetch(`${url}/health`);
        if (resp.ok) return;
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error(`Band server not ready after ${maxWaitMs}ms`);
  }

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const startTime = Date.now();

    try {
      const serverUrl = await this.ensureVmRunning();
      const startupMs = Date.now() - startTime;

      // Initialize with band config
      const initResp = await fetch(`${serverUrl}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.band),
      });

      if (!initResp.ok) {
        throw new Error(`Init failed: ${await initResp.text()}`);
      }

      // Execute
      const execResp = await fetch(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.payload),
      });

      const durationMs = Date.now() - startTime;
      const data = await execResp.json() as { error?: { code: string; message: string } };

      if (!execResp.ok) {
        return {
          success: false,
          error: data.error ?? { code: "LIMA_ERROR", message: "Execution failed" },
          metrics: { startupMs, durationMs, inputBytes: JSON.stringify(input.payload).length, outputBytes: 0 },
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
          outputBytes: JSON.stringify(data).length,
        },
        target: this.target,
      };
    } catch (err) {
      return {
        success: false,
        error: { code: "LIMA_ERROR", message: err instanceof Error ? err.message : String(err) },
        metrics: { startupMs: 0, durationMs: Date.now() - startTime, inputBytes: 0, outputBytes: 0 },
        target: this.target,
      };
    }
  }

  async cleanup(): Promise<void> {
    // Optionally stop VM
    // For now, keep it running for reuse
    this.vmReady = false;
    this.vmUrl = null;
  }
}

export function createLimaExecutor(options?: ExecutorOptions): Executor {
  return new LimaExecutor(options);
}
