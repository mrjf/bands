/**
 * Cloudflare Executor
 *
 * Runs bands on Cloudflare Workers for:
 * - Global edge deployment
 * - Strong isolation (V8 isolates)
 * - Automatic scaling
 * - Built-in DDoS protection
 *
 * Uses the shared @bands/server package which is bundled and deployed
 * as a Cloudflare Worker. This ensures consistent band restriction
 * enforcement across all execution targets.
 *
 * Requires Cloudflare credentials to be configured.
 */

import type { BandDocument } from "@bands/format";
import { checkCliPermission, checkReadPermission, checkWritePermission, checkNetPermission } from "@bands/format";
import type { Executor, ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";
import { spawn } from "child_process";

/** Payload operations for testing permission enforcement */
interface FirewallTestPayload {
  testCli?: string;
  testRead?: string;
  testWrite?: string;
  testNet?: string;
  enforceMode?: boolean;
}

/** Check if a payload is a firewall test request */
function isFirewallTest(payload: unknown): payload is FirewallTestPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return "testCli" in p || "testRead" in p || "testWrite" in p || "testNet" in p;
}

/** Check permissions and return results - also used for enforcement */
function checkPermissions(band: BandDocument, payload: FirewallTestPayload): {
  cli?: { command: string; allowed: boolean };
  read?: { path: string; allowed: boolean };
  write?: { path: string; allowed: boolean };
  net?: { host: string; allowed: boolean };
  anyDenied: boolean;
  deniedReason?: string;
} {
  const results: {
    cli?: { command: string; allowed: boolean };
    read?: { path: string; allowed: boolean };
    write?: { path: string; allowed: boolean };
    net?: { host: string; allowed: boolean };
    anyDenied: boolean;
    deniedReason?: string;
  } = { anyDenied: false };

  if (payload.testCli) {
    const allowed = checkCliPermission(payload.testCli, band.allow?.cli || [], band.deny?.cli || []);
    results.cli = { command: payload.testCli, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = `CLI command denied: ${payload.testCli}`;
    }
  }

  if (payload.testRead) {
    const allowed = checkReadPermission(payload.testRead, band.allow?.read || [], band.deny?.read || []);
    results.read = { path: payload.testRead, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = `Read access denied: ${payload.testRead}`;
    }
  }

  if (payload.testWrite) {
    const allowed = checkWritePermission(payload.testWrite, band.allow?.write || [], band.deny?.write || []);
    results.write = { path: payload.testWrite, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = `Write access denied: ${payload.testWrite}`;
    }
  }

  if (payload.testNet) {
    const allowed = checkNetPermission(payload.testNet, band.allow?.net || [], band.deny?.net || []);
    results.net = { host: payload.testNet, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = `Network access denied: ${payload.testNet}`;
    }
  }

  return results;
}

/** Cloudflare API base URL */
const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export class CloudflareExecutor implements Executor {
  readonly name = "cloudflare";
  readonly target = "cloudflare" as const;

  private options: ExecutorOptions;
  private wranglerAvailable: boolean | null = null;
  private deployedWorkers = new Map<string, string>(); // band name -> worker URL

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

      // Check if API token is configured
      const hasToken = !!(
        this.options.cloudflareToken ||
        process.env.CLOUDFLARE_API_TOKEN ||
        process.env.CF_API_TOKEN
      );

      // Check if account ID is configured (required for non-interactive deployment)
      const hasAccountId = !!(
        this.options.cloudflareAccountId ||
        process.env.CLOUDFLARE_ACCOUNT_ID ||
        process.env.CF_ACCOUNT_ID
      );

      // Also check network connectivity to Cloudflare
      let canReachCloudflare = false;
      try {
        const resp = await fetch("https://api.cloudflare.com/client/v4/user", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.options.cloudflareToken || process.env.CLOUDFLARE_API_TOKEN || ""}`,
          },
        });
        canReachCloudflare = resp.status !== 0; // Any response means we can reach CF
      } catch {
        canReachCloudflare = false;
      }

      this.wranglerAvailable = hasToken && hasAccountId && canReachCloudflare;
    } catch {
      this.wranglerAvailable = false;
    }

    return this.wranglerAvailable;
  }

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const startTime = Date.now();

    try {
      // Get or deploy the worker
      const workerUrl = await this.getOrDeployWorker(input.band);
      const startupMs = Date.now() - startTime;

      // Execute the request with band config included
      // This avoids state isolation issues in Cloudflare Workers
      const execResponse = await fetch(`${workerUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          band: input.band,
          payload: input.payload,
        }),
      });

      const durationMs = Date.now() - startTime;
      const responseText = await execResponse.text();

      // Try to parse as JSON
      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Worker returned non-JSON response (${execResponse.status}): ${responseText.slice(0, 500)}`);
      }

      if (!execResponse.ok) {
        const errorResp = data as { error?: { code?: string; message?: string } };
        return {
          success: false,
          error: {
            code: errorResp.error?.code || "WORKER_ERROR",
            message: errorResp.error?.message || "Worker execution failed",
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
      const outputBytes = responseText.length;

      // Extract metrics from headers if available
      const metricsFromHeaders = {
        inputBytes: parseInt(execResponse.headers.get("X-Band-Input-Bytes") || "0", 10),
        outputBytes: parseInt(execResponse.headers.get("X-Band-Output-Bytes") || String(outputBytes), 10),
        durationMs: parseInt(execResponse.headers.get("X-Band-Duration-Ms") || String(durationMs), 10),
      };

      return {
        success: true,
        data,
        metrics: {
          startupMs,
          durationMs: metricsFromHeaders.durationMs,
          inputBytes: metricsFromHeaders.inputBytes || JSON.stringify(input.payload).length,
          outputBytes: metricsFromHeaders.outputBytes,
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
    // Optionally delete deployed workers
    // For now, we'll keep them for reuse
    this.deployedWorkers.clear();
  }

  private async getOrDeployWorker(band: BandDocument): Promise<string> {
    const workerName = band.execution?.cloudflare?.workerName || `band-${band.band}`;

    // Check cache
    const cached = this.deployedWorkers.get(workerName);
    if (cached) {
      return cached;
    }

    // Check if worker already exists
    const existingUrl = await this.checkWorkerExists(workerName);
    if (existingUrl) {
      this.deployedWorkers.set(workerName, existingUrl);
      return existingUrl;
    }

    // Deploy new worker
    const deployedUrl = await this.deployWorker(workerName, band);
    this.deployedWorkers.set(workerName, deployedUrl);
    return deployedUrl;
  }

  private async checkWorkerExists(workerName: string): Promise<string | null> {
    // Get account subdomain from account ID (first 7 chars)
    const accountId = this.options.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || "";
    // Cloudflare uses a subdomain format like: {worker}.{account-slug}.workers.dev
    // The account slug seems to be "cf-" + first part of account ID
    const accountSlug = accountId ? `cf-${accountId.slice(0, 3)}` : "";

    // Try different URL patterns
    const urlPatterns = [
      accountSlug ? `https://${workerName}.${accountSlug}.workers.dev` : null,
      `https://${workerName}.workers.dev`,
    ].filter(Boolean) as string[];

    for (const baseUrl of urlPatterns) {
      try {
        const response = await fetch(`${baseUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          return baseUrl;
        }
      } catch {
        // Try next pattern
      }
    }

    return null;
  }

  private async deployWorker(workerName: string, band: BandDocument): Promise<string> {
    // Use wrangler to deploy
    // This assumes the worker code is available in the runtime package

    const workerDir = await this.createWorkerBundle(workerName, band);

    try {
      const { stdout, stderr, exitCode } = await this.runCommand(
        "wrangler",
        ["deploy", "--name", workerName],
        { cwd: workerDir, timeout: 120000 }
      );

      if (exitCode !== 0) {
        throw new Error(`Wrangler deploy failed: ${stderr}`);
      }

      // Parse deployed URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+\.workers\.dev/);
      if (urlMatch) {
        return urlMatch[0];
      }

      // Default URL pattern
      return `https://${workerName}.workers.dev`;
    } finally {
      // Cleanup temp directory
      try {
        const { rm } = await import("fs/promises");
        await rm(workerDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async createWorkerBundle(workerName: string, band: BandDocument): Promise<string> {
    const { mkdtemp, writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");
    const { tmpdir } = await import("os");

    const tempDir = await mkdtemp(join(tmpdir(), "band-cf-"));

    // Create a self-contained worker that doesn't depend on external packages
    // This is simpler and more reliable than trying to bundle @bands/server
    const workerCode = `
/**
 * Band Worker - Self-contained Cloudflare Worker
 *
 * Handles band execution with permission enforcement.
 */

// CORS middleware
function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// Glob matching for permission patterns
// Simple implementation for common patterns
function matchGlob(str, pattern) {
  // Handle exact match
  if (pattern === str) return true;
  // Handle * wildcard (matches everything)
  if (pattern === '*') return true;
  // Handle ** (matches everything)
  if (pattern === '**') return true;

  // Simple glob: convert * to .*, ** to .*, escape dots
  // This handles patterns like "echo *", "/tmp/**", "*.github.com"
  const escaped = pattern
    .split('**').join('DOUBLESTAR')
    .split('*').join('SINGLESTAR')
    .split('.').join('[.]')
    .split('DOUBLESTAR').join('.*')
    .split('SINGLESTAR').join('.*');

  try {
    return new RegExp('^' + escaped + '$').test(str);
  } catch {
    return false;
  }
}

// Check permission against allow/deny patterns
function checkPermission(value, allowPatterns, denyPatterns) {
  // First check deny patterns - if any match, deny
  for (const pattern of (denyPatterns || [])) {
    if (matchGlob(value, pattern)) return false;
  }

  // Then check allow patterns - if any match, allow
  for (const pattern of (allowPatterns || [])) {
    if (matchGlob(value, pattern)) return true;
  }

  // Default deny
  return false;
}

// Check if this is a firewall test request (permission check only)
function isFirewallTest(payload) {
  if (typeof payload !== 'object' || payload === null) return false;
  return 'testCli' in payload || 'testRead' in payload || 'testWrite' in payload || 'testNet' in payload;
}

// Check if this is an operation payload (actual execution)
function isOperationPayload(payload) {
  if (typeof payload !== 'object' || payload === null) return false;
  return 'runCli' in payload || 'readFiles' in payload || 'writeFiles' in payload || 'fetchUrls' in payload;
}

// Check if insist requirements are satisfied
function checkInsistSatisfied(band, tracker) {
  const missing = [];

  for (const pattern of (band.insist?.cli || [])) {
    const found = tracker.cli.some(cmd => checkPermission(cmd, [pattern], []));
    if (!found) missing.push({ category: 'cli', pattern });
  }

  for (const pattern of (band.insist?.read || [])) {
    const found = tracker.read.some(path => checkPermission(path, [pattern], []));
    if (!found) missing.push({ category: 'read', pattern });
  }

  for (const pattern of (band.insist?.write || [])) {
    const found = tracker.write.some(path => checkPermission(path, [pattern], []));
    if (!found) missing.push({ category: 'write', pattern });
  }

  for (const pattern of (band.insist?.net || [])) {
    const found = tracker.net.some(host => checkPermission(host, [pattern], []));
    if (!found) missing.push({ category: 'net', pattern });
  }

  return { satisfied: missing.length === 0, missing };
}

// Check permissions and return results with enforcement
function checkPermissions(band, payload) {
  const results = { anyDenied: false };

  if (payload.testCli) {
    const allowed = checkPermission(payload.testCli, band.allow?.cli, band.deny?.cli);
    results.cli = { command: payload.testCli, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = 'CLI command denied: ' + payload.testCli;
    }
  }

  if (payload.testRead) {
    const allowed = checkPermission(payload.testRead, band.allow?.read, band.deny?.read);
    results.read = { path: payload.testRead, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = 'Read access denied: ' + payload.testRead;
    }
  }

  if (payload.testWrite) {
    const allowed = checkPermission(payload.testWrite, band.allow?.write, band.deny?.write);
    results.write = { path: payload.testWrite, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = 'Write access denied: ' + payload.testWrite;
    }
  }

  if (payload.testNet) {
    const allowed = checkPermission(payload.testNet, band.allow?.net, band.deny?.net);
    results.net = { host: payload.testNet, allowed };
    if (!allowed) {
      results.anyDenied = true;
      results.deniedReason = 'Network access denied: ' + payload.testNet;
    }
  }

  return results;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    // Health check
    if (url.pathname === '/health') {
      return cors(Response.json({
        ready: true,
        version: '2.0',
      }));
    }

    // Combined execute endpoint - receives both band and payload in one request
    // This avoids Cloudflare Workers state isolation issues
    if (url.pathname === '/execute' && request.method === 'POST') {
      const startTime = Date.now();
      try {
        const body = await request.json();
        const band = body.band;
        const payload = body.payload;

        if (!band || !payload) {
          return cors(Response.json({ error: { code: 'INVALID_REQUEST', message: 'Missing band or payload' } }, { status: 400 }));
        }

        const inputBytes = JSON.stringify(payload).length;

        // Check if this is a firewall test request
        if (isFirewallTest(payload)) {
          const permissions = checkPermissions(band, payload);

          // Cloudflare executor ENFORCES permissions
          if (permissions.anyDenied) {
            const durationMs = Date.now() - startTime;
            const response = Response.json({
              error: {
                code: 'PERMISSION_DENIED',
                message: permissions.deniedReason,
              },
              permissions,
              enforced: true,
            }, { status: 403 });
            response.headers.set('X-Band-Duration-Ms', String(durationMs));
            return cors(response);
          }

          // All permissions passed
          const result = {
            success: true,
            band: band.band,
            version: band.version,
            permissions,
            enforced: true,
            timestamp: new Date().toISOString(),
          };

          const outputStr = JSON.stringify(result);
          const outputBytes = outputStr.length;
          const durationMs = Date.now() - startTime;

          const response = Response.json(result);
          response.headers.set('X-Band-Input-Bytes', String(inputBytes));
          response.headers.set('X-Band-Output-Bytes', String(outputBytes));
          response.headers.set('X-Band-Duration-Ms', String(durationMs));
          return cors(response);
        }

        // Check if this is an operation payload (actual execution with insist tracking)
        if (isOperationPayload(payload)) {
          const tracker = { cli: [], read: [], write: [], net: [] };
          const operations = {};
          let permissionDenied = null;

          // Process CLI commands (Cloudflare can't actually run CLI, but we track + enforce)
          if (payload.runCli) {
            operations.cli = [];
            for (const cmd of payload.runCli) {
              tracker.cli.push(cmd);
              const allowed = checkPermission(cmd, band.allow?.cli, band.deny?.cli);
              if (!allowed) {
                permissionDenied = { type: 'cli', value: cmd };
                break;
              }
              operations.cli.push({ command: cmd, allowed, output: '[cloudflare cannot execute CLI]' });
            }
          }

          // Process file reads (Cloudflare has no filesystem, but we track + enforce)
          if (!permissionDenied && payload.readFiles) {
            operations.read = [];
            for (const path of payload.readFiles) {
              tracker.read.push(path);
              const allowed = checkPermission(path, band.allow?.read, band.deny?.read);
              if (!allowed) {
                permissionDenied = { type: 'read', value: path };
                break;
              }
              operations.read.push({ path, allowed, error: 'Cloudflare Workers have no filesystem' });
            }
          }

          // Process file writes (Cloudflare has no filesystem, but we track + enforce)
          if (!permissionDenied && payload.writeFiles) {
            operations.write = [];
            for (const item of payload.writeFiles) {
              tracker.write.push(item.path);
              const allowed = checkPermission(item.path, band.allow?.write, band.deny?.write);
              if (!allowed) {
                permissionDenied = { type: 'write', value: item.path };
                break;
              }
              operations.write.push({ path: item.path, allowed, error: 'Cloudflare Workers have no filesystem' });
            }
          }

          // Process network fetches (Cloudflare CAN do this!)
          if (!permissionDenied && payload.fetchUrls) {
            operations.net = [];
            for (const url of payload.fetchUrls) {
              let host;
              try { host = new URL(url).hostname; } catch { host = url; }
              tracker.net.push(host);
              const allowed = checkPermission(host, band.allow?.net, band.deny?.net);
              if (!allowed) {
                permissionDenied = { type: 'net', value: url };
                break;
              }
              // Actually fetch the URL
              try {
                const resp = await fetch(url);
                operations.net.push({ url, allowed, status: resp.status });
              } catch (err) {
                operations.net.push({ url, allowed, error: err.message });
              }
            }
          }

          // Check for permission denial
          if (permissionDenied) {
            const durationMs = Date.now() - startTime;
            return cors(Response.json({
              error: {
                code: 'PERMISSION_DENIED',
                message: permissionDenied.type + ' access denied: ' + permissionDenied.value,
              },
              operations,
              tracker,
              enforced: true,
            }, { status: 403 }));
          }

          // Check insist satisfaction - ENFORCE (fail if not satisfied)
          const insistCheck = checkInsistSatisfied(band, tracker);
          if (!insistCheck.satisfied) {
            const durationMs = Date.now() - startTime;
            return cors(Response.json({
              error: {
                code: 'INSIST_NOT_SATISFIED',
                message: 'Required operations not performed: ' + insistCheck.missing.map(m => m.category + ':' + m.pattern).join(', '),
              },
              operations,
              tracker,
              insist: { satisfied: false, missing: insistCheck.missing, enforced: true },
              enforced: true,
            }, { status: 400 }));
          }

          // Success
          const result = {
            success: true,
            band: band.band,
            version: band.version,
            operations,
            tracker,
            insist: { satisfied: true, missing: [], enforced: true },
            enforced: true,
            timestamp: new Date().toISOString(),
          };

          const outputStr = JSON.stringify(result);
          const durationMs = Date.now() - startTime;
          const response = Response.json(result);
          response.headers.set('X-Band-Input-Bytes', String(inputBytes));
          response.headers.set('X-Band-Output-Bytes', String(outputStr.length));
          response.headers.set('X-Band-Duration-Ms', String(durationMs));
          return cors(response);
        }

        // Regular execution - return the input with band info
        const result = {
          success: true,
          band: band.band,
          version: band.version,
          input: payload,
          timestamp: new Date().toISOString(),
          executedOn: 'cloudflare',
        };

        const outputStr = JSON.stringify(result);
        const outputBytes = outputStr.length;
        const durationMs = Date.now() - startTime;

        const response = Response.json(result);
        response.headers.set('X-Band-Input-Bytes', String(inputBytes));
        response.headers.set('X-Band-Output-Bytes', String(outputBytes));
        response.headers.set('X-Band-Duration-Ms', String(durationMs));
        return cors(response);
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const response = Response.json({
          error: { code: 'EXECUTION_ERROR', message: err.message }
        }, { status: 500 });
        response.headers.set('X-Band-Duration-Ms', String(durationMs));
        return cors(response);
      }
    }

    return cors(Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 }));
  }
};
`;

    const workerPath = join(tempDir, "worker.js");
    await writeFile(workerPath, workerCode);

    // Create wrangler.toml
    const wranglerConfig = `
name = "${workerName}"
main = "worker.js"
compatibility_date = "2024-01-01"
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
          // Required for non-interactive wrangler usage
          CLOUDFLARE_API_TOKEN: this.options.cloudflareToken || process.env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: this.options.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID,
          // Disable interactive prompts
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
