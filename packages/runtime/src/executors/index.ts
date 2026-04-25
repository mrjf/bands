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
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

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
  const target = options.target || band.execution?.target;
  if (!target) {
    throw new Error("No execution target specified. Set execution.target in the band or pass target in options.");
  }

  // Validate input against contract schema (resolve string refs to JSON)
  const inputSchema = resolveContractSchema(band.contract?.input, options.workdir);
  if (inputSchema) {
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

  // Validate output against contract schema (resolve string refs to JSON)
  if (result.success) {
    const outputSchema = resolveContractSchema(band.contract?.output, options.workdir);
    if (outputSchema) {
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

/**
 * Resolve a contract schema field to a JSON Schema object.
 *
 * - If it's already an object, return it directly.
 * - If it's a relative file path (e.g., "./schemas/input.json"), resolve
 *   against workdir and read the file.
 * - If it's a URL (http/https), throw (not yet supported).
 * - Throws if a declared schema file is missing or unparseable.
 */
function resolveContractSchema(
  schema: string | Record<string, unknown> | undefined,
  workdir?: string
): Record<string, unknown> | null {
  if (!schema) return null;

  // Already an object — use directly
  if (typeof schema === "object") return schema;

  // URL — not supported yet
  if (schema.startsWith("http://") || schema.startsWith("https://")) {
    throw new Error(`URL contract schemas are not yet supported: ${schema}`);
  }

  // File path — resolve relative to workdir
  const filePath = workdir ? resolve(workdir, schema) : resolve(schema);
  if (!existsSync(filePath)) {
    throw new Error(`Contract schema file not found: ${schema} (resolved to ${filePath})`);
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (e) {
    throw new Error(`Failed to parse contract schema ${schema}: ${e instanceof Error ? e.message : e}`);
  }
}
