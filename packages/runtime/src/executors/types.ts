/**
 * Executor types and interfaces.
 *
 * Executors are responsible for running bands in different environments:
 * - local-dangerously: No isolation, runs in the current process
 * - local-docker: Runs in a Docker container with restrictions enforced
 * - cloudflare: Runs in a remote Cloudflare Worker
 */

import type { BandDocument, ExecutionTarget } from "@bands/format";

/** Input to an executor */
export interface ExecutorInput {
  /** The band configuration */
  band: BandDocument;

  /** The request payload */
  payload: unknown;

  /** Working directory for file operations */
  workdir?: string;

  /** Environment variables to pass to the execution */
  env?: Record<string, string>;

  /** Timeout override (respects band limits) */
  timeoutMs?: number;
}

/** Result from an executor */
export interface ExecutorResult {
  /** Whether execution succeeded */
  success: boolean;

  /** The response data (for sync mode) */
  data?: unknown;

  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /** Execution metrics */
  metrics: {
    /** Time to start execution (cold start) */
    startupMs: number;
    /** Total execution time */
    durationMs: number;
    /** Input size in bytes */
    inputBytes: number;
    /** Output size in bytes */
    outputBytes: number;
  };

  /** Where execution happened */
  target: ExecutionTarget;
}

/** Executor interface that all implementations must satisfy */
export interface Executor {
  /** Executor name for logging/debugging */
  readonly name: string;

  /** The target this executor handles */
  readonly target: ExecutionTarget;

  /**
   * Check if this executor is available (e.g., Docker is installed).
   * Should be fast and cacheable.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute a band synchronously.
   * Returns when execution completes.
   */
  execute(input: ExecutorInput): Promise<ExecutorResult>;

  /**
   * Clean up any resources (containers, connections, etc.).
   */
  cleanup?(): Promise<void>;
}

/** Options for creating an executor */
export interface ExecutorOptions {
  /** Enable verbose logging */
  verbose?: boolean;

  /** Custom Docker image (for local-docker) */
  dockerImage?: string;

  /** Cloudflare API token (for cloudflare) */
  cloudflareToken?: string;

  /** Cloudflare account ID (for cloudflare) */
  cloudflareAccountId?: string;

  /** Lima VM name (for lima executor) */
  limaVmName?: string;

  /** Lima port (for lima executor) */
  limaPort?: number;
}

/** Executor factory function */
export type ExecutorFactory = (options?: ExecutorOptions) => Executor;

/** Registry of executor factories */
export interface ExecutorRegistry {
  register(target: ExecutionTarget, factory: ExecutorFactory): void;
  get(target: ExecutionTarget): ExecutorFactory | undefined;
  create(target: ExecutionTarget, options?: ExecutorOptions): Executor | undefined;
  listAvailable(): Promise<ExecutionTarget[]>;
}
