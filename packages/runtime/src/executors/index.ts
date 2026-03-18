/**
 * Executor module - manages band execution across different targets.
 */

export * from "./types";
export { executorRegistry, getExecutor } from "./registry";
export { LocalDangerousExecutor, createLocalDangerousExecutor } from "./local-dangerous";
export { CloudflareExecutor, createCloudflareExecutor } from "./cloudflare";
export { LimaExecutor, createLimaExecutor } from "./lima";

import { executorRegistry, getExecutor } from "./registry";
import { createLocalDangerousExecutor } from "./local-dangerous";
import { createCloudflareExecutor } from "./cloudflare";
import { createLimaExecutor } from "./lima";

// Register all executors on module load
executorRegistry.register("local-dangerously", createLocalDangerousExecutor);
executorRegistry.register("cloudflare", createCloudflareExecutor);
executorRegistry.register("local-lima", createLimaExecutor);

import type { BandDocument, ExecutionTarget } from "@bands/format";
import { validateContractSchema } from "@bands/format";
import type { ExecutorInput, ExecutorResult, ExecutorOptions } from "./types";

/**
 * Execute a band on its configured target (or override).
 *
 * @param band - The band to execute
 * @param payload - The input payload
 * @param options - Execution options
 * @returns Execution result
 */
export async function executeBand(
  band: BandDocument,
  payload: unknown,
  options: {
    /** Override the execution target */
    target?: ExecutionTarget;
    /** Working directory */
    workdir?: string;
    /** Environment variables */
    env?: Record<string, string>;
    /** Timeout in ms */
    timeoutMs?: number;
    /** Executor options */
    executorOptions?: ExecutorOptions;
  } = {}
): Promise<ExecutorResult> {
  const target = options.target || band.execution?.target || "local-dangerously";

  // Validate input against contract schema (skip string refs — resolution is separate)
  const inputSchema = band.contract?.input;
  if (inputSchema && typeof inputSchema === "object") {
    const err = await validateContractSchema(payload, inputSchema, "contract.input");
    if (err) {
      return {
        success: false,
        error: { code: "CONTRACT_INPUT_INVALID", message: err },
        metrics: { startupMs: 0, durationMs: 0, inputBytes: 0, outputBytes: 0 },
        target,
      };
    }
  }

  const executor = await getExecutor(target, options.executorOptions);

  const input: ExecutorInput = {
    band,
    payload,
    workdir: options.workdir,
    env: options.env,
    timeoutMs: options.timeoutMs,
  };

  const result = await executor.execute(input);

  // Validate output against contract schema (skip string refs)
  if (result.success) {
    const outputSchema = band.contract?.output;
    if (outputSchema && typeof outputSchema === "object") {
      const err = await validateContractSchema(result.data, outputSchema, "contract.output");
      if (err) {
        return {
          success: false,
          error: { code: "CONTRACT_OUTPUT_INVALID", message: err },
          metrics: result.metrics,
          target,
        };
      }
    }
  }

  return result;
}

/**
 * List available execution targets on this system.
 */
export async function listAvailableTargets(): Promise<ExecutionTarget[]> {
  return executorRegistry.listAvailable();
}

/**
 * Check if a specific execution target is available.
 */
export async function isTargetAvailable(target: ExecutionTarget): Promise<boolean> {
  const executor = executorRegistry.create(target);
  if (!executor) return false;
  return executor.isAvailable();
}
