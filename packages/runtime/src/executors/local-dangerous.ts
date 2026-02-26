/**
 * Local Dangerous Executor
 *
 * Runs bands directly in the current process with NO isolation.
 * This is useful for:
 * - Development and testing
 * - Trusted bands that need full system access
 * - Performance-critical scenarios
 *
 * WARNING: This executor does NOT enforce band restrictions.
 * The band's capabilities, limits, and network rules are IGNORED.
 * Only use for trusted code in controlled environments.
 */

import type { BandDocument } from "@bands/format";
import { checkCliPermission, checkReadPermission, checkWritePermission, checkNetPermission } from "@bands/format";
import type { Executor, ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";

/** Payload operations for testing permission enforcement */
interface FirewallTestPayload {
  /** Test CLI command permission (check only) */
  testCli?: string;
  /** Test file read permission (check only) */
  testRead?: string;
  /** Test file write permission (check only) */
  testWrite?: string;
  /** Test network egress permission (check only) */
  testNet?: string;
}

/** Payload for actual operations (execute + track for insist) */
interface OperationPayload {
  /** Actually run CLI commands */
  runCli?: string[];
  /** Actually read files */
  readFiles?: string[];
  /** Actually write files */
  writeFiles?: { path: string; content: string }[];
  /** Actually fetch URLs */
  fetchUrls?: string[];
}

/** Check if a payload is a firewall test request (permission check only) */
function isFirewallTest(payload: unknown): payload is FirewallTestPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return "testCli" in p || "testRead" in p || "testWrite" in p || "testNet" in p;
}

/** Check if a payload has actual operations to perform */
function isOperationPayload(payload: unknown): payload is OperationPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return "runCli" in p || "readFiles" in p || "writeFiles" in p || "fetchUrls" in p;
}

/** Track what operations were performed */
interface AccessTracker {
  cli: string[];
  read: string[];
  write: string[];
  net: string[];
}

/** Check if all insist items were satisfied */
function checkInsistSatisfied(
  band: BandDocument,
  tracker: AccessTracker
): { satisfied: boolean; missing: { category: string; pattern: string }[] } {
  const missing: { category: string; pattern: string }[] = [];

  // Check CLI insists
  for (const pattern of band.insist?.cli || []) {
    const found = tracker.cli.some(cmd => checkCliPermission(cmd, [pattern], []));
    if (!found) {
      missing.push({ category: "cli", pattern });
    }
  }

  // Check read insists
  for (const pattern of band.insist?.read || []) {
    const found = tracker.read.some(path => checkReadPermission(path, [pattern], []));
    if (!found) {
      missing.push({ category: "read", pattern });
    }
  }

  // Check write insists
  for (const pattern of band.insist?.write || []) {
    const found = tracker.write.some(path => checkWritePermission(path, [pattern], []));
    if (!found) {
      missing.push({ category: "write", pattern });
    }
  }

  // Check net insists
  for (const pattern of band.insist?.net || []) {
    const found = tracker.net.some(host => checkNetPermission(host, [pattern], []));
    if (!found) {
      missing.push({ category: "net", pattern });
    }
  }

  return { satisfied: missing.length === 0, missing };
}

/** Check permissions and return results */
function checkPermissions(band: BandDocument, payload: FirewallTestPayload): {
  cli?: { command: string; allowed: boolean };
  read?: { path: string; allowed: boolean };
  write?: { path: string; allowed: boolean };
  net?: { host: string; allowed: boolean };
} {
  const results: ReturnType<typeof checkPermissions> = {};

  if (payload.testCli) {
    results.cli = {
      command: payload.testCli,
      allowed: checkCliPermission(payload.testCli, band.allow?.cli || [], band.deny?.cli || []),
    };
  }

  if (payload.testRead) {
    results.read = {
      path: payload.testRead,
      allowed: checkReadPermission(payload.testRead, band.allow?.read || [], band.deny?.read || []),
    };
  }

  if (payload.testWrite) {
    results.write = {
      path: payload.testWrite,
      allowed: checkWritePermission(payload.testWrite, band.allow?.write || [], band.deny?.write || []),
    };
  }

  if (payload.testNet) {
    results.net = {
      host: payload.testNet,
      allowed: checkNetPermission(payload.testNet, band.allow?.net || [], band.deny?.net || []),
    };
  }

  return results;
}

export class LocalDangerousExecutor implements Executor {
  readonly name = "local-dangerous";
  readonly target = "local-dangerously" as const;

  private options: ExecutorOptions;

  constructor(options: ExecutorOptions = {}) {
    this.options = options;
  }

  async isAvailable(): Promise<boolean> {
    // Always available - runs in current process
    return true;
  }

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const startTime = performance.now();
    const startupMs = 1; // Minimal startup (use 1 to avoid 0 which looks like error)

    try {
      const inputStr = JSON.stringify(input.payload);
      const inputBytes = inputStr.length;

      // Check if this is a firewall test request (permission check only)
      if (isFirewallTest(input.payload)) {
        const permissions = checkPermissions(input.band, input.payload);

        // local-dangerously reports what WOULD be allowed, but doesn't enforce
        // (all operations succeed regardless of permissions)
        const result = {
          success: true,
          band: input.band.band,
          version: input.band.version,
          permissions,
          enforced: false, // local-dangerously doesn't enforce
          timestamp: new Date().toISOString(),
        };

        const outputStr = JSON.stringify(result);
        const outputBytes = outputStr.length;
        const durationMs = Math.max(1, Math.round(performance.now() - startTime));

        return {
          success: true,
          data: result,
          metrics: { startupMs, durationMs, inputBytes, outputBytes },
          target: this.target,
        };
      }

      // Check if this is an operation payload (actual execution + insist tracking)
      if (isOperationPayload(input.payload)) {
        const tracker: AccessTracker = { cli: [], read: [], write: [], net: [] };
        const operations: {
          cli?: { command: string; allowed: boolean; output?: string }[];
          read?: { path: string; allowed: boolean; content?: string; error?: string }[];
          write?: { path: string; allowed: boolean; error?: string }[];
          net?: { url: string; allowed: boolean; status?: number; error?: string }[];
        } = {};

        const payload = input.payload as OperationPayload;

        // Execute CLI commands (local-dangerously doesn't enforce, just tracks)
        if (payload.runCli) {
          operations.cli = [];
          for (const cmd of payload.runCli) {
            tracker.cli.push(cmd);
            const allowed = checkCliPermission(cmd, input.band.allow?.cli || [], input.band.deny?.cli || []);
            // local-dangerously runs regardless of permission
            operations.cli.push({ command: cmd, allowed, output: `[simulated] ${cmd}` });
          }
        }

        // Read files (local-dangerously doesn't enforce, just tracks)
        if (payload.readFiles) {
          operations.read = [];
          for (const path of payload.readFiles) {
            tracker.read.push(path);
            const allowed = checkReadPermission(path, input.band.allow?.read || [], input.band.deny?.read || []);
            // local-dangerously reads regardless of permission
            try {
              const content = await Bun.file(path).text();
              operations.read.push({ path, allowed, content });
            } catch (err) {
              operations.read.push({ path, allowed, error: err instanceof Error ? err.message : String(err) });
            }
          }
        }

        // Write files (local-dangerously doesn't enforce, just tracks)
        if (payload.writeFiles) {
          operations.write = [];
          for (const { path, content } of payload.writeFiles) {
            tracker.write.push(path);
            const allowed = checkWritePermission(path, input.band.allow?.write || [], input.band.deny?.write || []);
            // local-dangerously writes regardless of permission
            try {
              await Bun.write(path, content);
              operations.write.push({ path, allowed });
            } catch (err) {
              operations.write.push({ path, allowed, error: err instanceof Error ? err.message : String(err) });
            }
          }
        }

        // Fetch URLs (local-dangerously doesn't enforce, just tracks)
        if (payload.fetchUrls) {
          operations.net = [];
          for (const url of payload.fetchUrls) {
            const host = new URL(url).hostname;
            tracker.net.push(host);
            const allowed = checkNetPermission(host, input.band.allow?.net || [], input.band.deny?.net || []);
            // local-dangerously fetches regardless of permission
            try {
              const resp = await fetch(url);
              operations.net.push({ url, allowed, status: resp.status });
            } catch (err) {
              operations.net.push({ url, allowed, error: err instanceof Error ? err.message : String(err) });
            }
          }
        }

        // Check insist satisfaction (local-dangerously reports but doesn't fail)
        const insistCheck = checkInsistSatisfied(input.band, tracker);

        const result = {
          success: true,
          band: input.band.band,
          version: input.band.version,
          operations,
          tracker,
          insist: {
            satisfied: insistCheck.satisfied,
            missing: insistCheck.missing,
            enforced: false, // local-dangerously doesn't enforce insist
          },
          enforced: false,
          timestamp: new Date().toISOString(),
        };

        const outputStr = JSON.stringify(result);
        const outputBytes = outputStr.length;
        const durationMs = Math.max(1, Math.round(performance.now() - startTime));

        return {
          success: true,
          data: result,
          metrics: { startupMs, durationMs, inputBytes, outputBytes },
          target: this.target,
        };
      }

      // Simple execution: echo input with band info
      // This executor doesn't actually run skills - it's just for basic testing
      const result = {
        success: true,
        band: input.band.band,
        version: input.band.version,
        input: input.payload,
        timestamp: new Date().toISOString(),
      };

      const outputStr = JSON.stringify(result);
      const outputBytes = outputStr.length;
      const durationMs = Math.max(1, Math.round(performance.now() - startTime));

      return {
        success: true,
        data: result,
        metrics: { startupMs, durationMs, inputBytes, outputBytes },
        target: this.target,
      };
    } catch (err) {
      const durationMs = Math.max(1, Math.round(performance.now() - startTime));
      return {
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: err instanceof Error ? err.message : String(err),
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
  }
}

/** Factory function for the registry */
export function createLocalDangerousExecutor(options?: ExecutorOptions): Executor {
  return new LocalDangerousExecutor(options);
}
