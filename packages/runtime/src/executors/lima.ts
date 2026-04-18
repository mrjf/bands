/**
 * Lima Executor
 *
 * Runs bands in a persistent Lima VM on macOS.
 * The VM runs band-server.ts which enforces restrictions via iptables + bwrap.
 *
 * The band-server uses a cooked sandbox model:
 * - First request with a set of permissions cooks the sandbox (iptables, CLI wrappers)
 * - Subsequent requests with the same permissions reuse the cook (~ms overhead)
 * - Different permissions auto-recook
 *
 * This executor translates BandDocument + payload into the /exec protocol,
 * checking permissions on the host side and delegating enforcement to the VM.
 */

import type { BandDocument } from "@bands/format";
import { checkCliPermission, checkReadPermission, checkWritePermission, checkNetPermission } from "@bands/format";
import type { Executor, ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";
import { execSync } from "child_process";
import { setupLima } from "../setup";

const DEFAULT_VM_NAME = "bands-executor";
const DEFAULT_PORT = 9000;

/** Test payload: check if a permission would be allowed (no execution) */
interface FirewallTestPayload {
  testCli?: string;
  testRead?: string;
  testWrite?: string;
  testNet?: string;
}

/** Test payload: perform operations and track for insist */
interface OperationPayload {
  runCli?: string[];
  readFiles?: string[];
  writeFiles?: { path: string; content: string }[];
  fetchUrls?: string[];
}

function isFirewallTest(payload: unknown): payload is FirewallTestPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return "testCli" in p || "testRead" in p || "testWrite" in p || "testNet" in p;
}

function isOperationPayload(payload: unknown): payload is OperationPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return "runCli" in p || "readFiles" in p || "writeFiles" in p || "fetchUrls" in p;
}

export class LimaExecutor implements Executor {
  readonly name = "local-lima";
  readonly target = "local-lima" as const;

  private options: ExecutorOptions;
  private vmReady = false;
  private vmUrl: string | null = null;

  constructor(options: ExecutorOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync("limactl --version", { stdio: "pipe" });

      const vmName = this.options.limaVmName ?? DEFAULT_VM_NAME;
      const result = execSync("limactl list --json", { stdio: "pipe" }).toString();
      const parsed = JSON.parse(result);
      const vms = Array.isArray(parsed) ? parsed : [parsed];
      const vm = vms.find((v: { name: string; status: string }) => v.name === vmName);

      if (!vm || vm.status !== "Running") {
        return false;
      }

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

    try {
      const status = execSync(`limactl list --json`, { stdio: "pipe" }).toString();
      const parsed = JSON.parse(status);
      const vms = Array.isArray(parsed) ? parsed : [parsed];
      const vm = vms.find((v: any) => v.name === vmName);

      if (!vm) {
        await this.createVm(vmName, port);
      } else if (vm.status !== "Running") {
        execSync(`limactl start ${vmName}`, { stdio: "pipe" });
      }
    } catch (err) {
      throw new Error(`Failed to ensure Lima VM: ${err instanceof Error ? err.message : err}`);
    }

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

  /** Extract sandbox permissions from a BandDocument for the /exec request */
  private extractRules(band: BandDocument) {
    return {
      allowNet: band.allow?.net ?? [],
      denyNet: band.deny?.net ?? [],
      allowCli: band.allow?.cli ?? [],
      denyCli: band.deny?.cli ?? [],
      allowRead: band.allow?.read ?? [],
      allowWrite: band.allow?.write ?? [],
    };
  }

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const startTime = Date.now();

    try {
      const serverUrl = await this.ensureVmRunning();
      const startupMs = Date.now() - startTime;
      const rules = this.extractRules(input.band);

      // Firewall test: check permissions on host side, enforce
      if (isFirewallTest(input.payload)) {
        return this.handleFirewallTest(input, startupMs);
      }

      // Operation payload: check permissions, then run allowed ops in VM
      if (isOperationPayload(input.payload)) {
        return await this.handleOperationPayload(input, serverUrl, startupMs, rules);
      }

      // Simple payload: generate echo script, run in VM
      return await this.handleSimplePayload(input, serverUrl, startupMs, rules);
    } catch (err) {
      return {
        success: false,
        error: { code: "LIMA_ERROR", message: err instanceof Error ? err.message : String(err) },
        metrics: { startupMs: 0, durationMs: Date.now() - startTime, inputBytes: 0, outputBytes: 0 },
        target: this.target,
      };
    }
  }

  /** Firewall test: check permissions on host, return enforced result */
  private handleFirewallTest(input: ExecutorInput, startupMs: number): ExecutorResult {
    const startTime = Date.now();
    const payload = input.payload as FirewallTestPayload;
    const band = input.band;

    // Check the requested permission
    if (payload.testCli) {
      const allowed = checkCliPermission(payload.testCli, band.allow?.cli ?? [], band.deny?.cli ?? []);
      if (!allowed) {
        return {
          success: false,
          error: { code: "PERMISSION_DENIED", message: `CLI command denied: ${payload.testCli}` },
          metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
          target: this.target,
        };
      }
    }

    if (payload.testRead) {
      const allowed = checkReadPermission(payload.testRead, band.allow?.read ?? [], band.deny?.read ?? []);
      if (!allowed) {
        return {
          success: false,
          error: { code: "PERMISSION_DENIED", message: `Read denied: ${payload.testRead}` },
          metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
          target: this.target,
        };
      }
    }

    if (payload.testWrite) {
      const allowed = checkWritePermission(payload.testWrite, band.allow?.write ?? [], band.deny?.write ?? []);
      if (!allowed) {
        return {
          success: false,
          error: { code: "PERMISSION_DENIED", message: `Write denied: ${payload.testWrite}` },
          metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
          target: this.target,
        };
      }
    }

    if (payload.testNet) {
      const allowed = checkNetPermission(payload.testNet, band.allow?.net ?? [], band.deny?.net ?? []);
      if (!allowed) {
        return {
          success: false,
          error: { code: "PERMISSION_DENIED", message: `Network denied: ${payload.testNet}` },
          metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
          target: this.target,
        };
      }
    }

    // All checked permissions are allowed
    const result = {
      success: true,
      band: input.band.band,
      permissions: {
        ...(payload.testCli ? { cli: { command: payload.testCli, allowed: true } } : {}),
        ...(payload.testRead ? { read: { path: payload.testRead, allowed: true } } : {}),
        ...(payload.testWrite ? { write: { path: payload.testWrite, allowed: true } } : {}),
        ...(payload.testNet ? { net: { host: payload.testNet, allowed: true } } : {}),
      },
      enforced: true,
      timestamp: new Date().toISOString(),
    };

    const outputStr = JSON.stringify(result);
    return {
      success: true,
      data: result,
      metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(input.payload).length, outputBytes: outputStr.length },
      target: this.target,
    };
  }

  /** Operation payload: check permissions, run allowed ops in VM */
  private async handleOperationPayload(
    input: ExecutorInput,
    serverUrl: string,
    startupMs: number,
    rules: ReturnType<LimaExecutor["extractRules"]>
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    const payload = input.payload as OperationPayload;
    const band = input.band;

    // Check all operations for permission violations first
    if (payload.runCli) {
      for (const cmd of payload.runCli) {
        if (!checkCliPermission(cmd, band.allow?.cli ?? [], band.deny?.cli ?? [])) {
          return {
            success: false,
            error: { code: "PERMISSION_DENIED", message: `CLI command denied: ${cmd}` },
            metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
            target: this.target,
          };
        }
      }
    }

    if (payload.readFiles) {
      for (const path of payload.readFiles) {
        if (!checkReadPermission(path, band.allow?.read ?? [], band.deny?.read ?? [])) {
          return {
            success: false,
            error: { code: "PERMISSION_DENIED", message: `Read denied: ${path}` },
            metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
            target: this.target,
          };
        }
      }
    }

    if (payload.writeFiles) {
      for (const { path } of payload.writeFiles) {
        if (!checkWritePermission(path, band.allow?.write ?? [], band.deny?.write ?? [])) {
          return {
            success: false,
            error: { code: "PERMISSION_DENIED", message: `Write denied: ${path}` },
            metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
            target: this.target,
          };
        }
      }
    }

    if (payload.fetchUrls) {
      for (const url of payload.fetchUrls) {
        const host = new URL(url).hostname;
        if (!checkNetPermission(host, band.allow?.net ?? [], band.deny?.net ?? [])) {
          return {
            success: false,
            error: { code: "PERMISSION_DENIED", message: `Network denied: ${host}` },
            metrics: { startupMs, durationMs: Date.now() - startTime, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
            target: this.target,
          };
        }
      }
    }

    // Generate a script that performs the allowed operations
    const scriptLines = ["#!/bin/bash", "set -e"];

    if (payload.runCli) {
      for (const cmd of payload.runCli) {
        scriptLines.push(cmd);
      }
    }

    if (payload.readFiles) {
      for (const path of payload.readFiles) {
        scriptLines.push(`cat "${path}" > /dev/null 2>&1 || true`);
      }
    }

    if (payload.writeFiles) {
      for (const { path, content } of payload.writeFiles) {
        scriptLines.push(`mkdir -p "$(dirname "${path}")" && echo '${content.replace(/'/g, "'\\''")}' > "${path}"`);
      }
    }

    if (payload.fetchUrls) {
      for (const url of payload.fetchUrls) {
        scriptLines.push(`curl -s -o /dev/null "${url}" || true`);
      }
    }

    // Write result to output
    scriptLines.push(`echo '{"success": true}' > "$OUTPUT_PATH"`);

    const script = scriptLines.join("\n");

    // Run in VM via /exec
    const execReq = {
      script,
      input: payload,
      ...rules,
      insist: input.band.insist,
    };

    const resp = await fetch(`${serverUrl}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(execReq),
      signal: AbortSignal.timeout(65000),
    });

    const result = await resp.json() as any;
    const durationMs = Date.now() - startTime;

    if (!result.success) {
      // Translate insist failures
      const code = result.error?.includes("Insist not satisfied")
        ? "INSIST_NOT_SATISFIED"
        : "LIMA_ERROR";
      return {
        success: false,
        error: { code, message: result.error },
        metrics: { startupMs, durationMs, inputBytes: JSON.stringify(payload).length, outputBytes: 0 },
        target: this.target,
      };
    }

    return {
      success: true,
      data: result.data,
      metrics: {
        startupMs,
        durationMs,
        inputBytes: JSON.stringify(payload).length,
        outputBytes: result.data ? JSON.stringify(result.data).length : 0,
      },
      target: this.target,
    };
  }

  /** Simple payload: generate echo script, run in VM */
  private async handleSimplePayload(
    input: ExecutorInput,
    serverUrl: string,
    startupMs: number,
    rules: ReturnType<LimaExecutor["extractRules"]>
  ): Promise<ExecutorResult> {
    const startTime = Date.now();
    const inputStr = JSON.stringify(input.payload);

    // Script that echoes input with band metadata
    const script = `#!/bin/bash
INPUT=$(cat "$INPUT_PATH")
echo "{\\"success\\": true, \\"band\\": \\"${input.band.band}\\", \\"input\\": $INPUT, \\"timestamp\\": \\"$(date -Iseconds)\\"}" > "$OUTPUT_PATH"`;

    const execReq = {
      script,
      input: input.payload,
      ...rules,
    };

    const resp = await fetch(`${serverUrl}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(execReq),
      signal: AbortSignal.timeout(65000),
    });

    const result = await resp.json() as any;
    const durationMs = Date.now() - startTime;

    if (!result.success) {
      return {
        success: false,
        error: { code: "LIMA_ERROR", message: result.error || "Execution failed" },
        metrics: { startupMs, durationMs, inputBytes: inputStr.length, outputBytes: 0 },
        target: this.target,
      };
    }

    return {
      success: true,
      data: result.data,
      metrics: {
        startupMs,
        durationMs,
        inputBytes: inputStr.length,
        outputBytes: result.data ? JSON.stringify(result.data).length : 0,
      },
      target: this.target,
    };
  }

  async cleanup(): Promise<void> {
    // Flush the cook in the VM
    if (this.vmUrl) {
      try {
        await fetch(`${this.vmUrl}/flush`, { method: "POST" });
      } catch { /* ignore */ }
    }
    this.vmReady = false;
    this.vmUrl = null;
  }
}

export function createLimaExecutor(options?: ExecutorOptions): Executor {
  return new LimaExecutor(options);
}
