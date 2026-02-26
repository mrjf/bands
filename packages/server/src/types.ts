import type { BandDocument } from "@bands/format";

/** Request to execute a band */
export interface BandRequest {
  /** The input payload */
  payload: unknown;
  /** Environment variables to expose */
  env?: Record<string, string>;
  /** Working directory (for local executors) */
  workdir?: string;
}

/** Successful execution result */
export interface BandSuccess {
  success: true;
  data: unknown;
  metrics: BandMetrics;
}

/** Failed execution result */
export interface BandError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  metrics?: BandMetrics;
}

export type BandResult = BandSuccess | BandError;

/** Execution metrics */
export interface BandMetrics {
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
}

/** Band server configuration */
export interface BandServerConfig {
  /** The band document defining restrictions */
  band: BandDocument;
  /** Port to listen on (for standalone mode) */
  port?: number;
  /** Host to bind to */
  host?: string;
}

/** Sandbox interface - implementations vary by platform */
export interface Sandbox {
  /** Check if a tool is allowed */
  canUseTool(tool: string): boolean;
  /** Check if filesystem access is allowed */
  canAccessPath(op: "read" | "write", path: string): boolean;
  /** Check if network access is allowed */
  canAccessNetwork(host: string): boolean;
  /** Get allowed environment variables */
  getAllowedEnv(): Record<string, string>;
  /** Execute code within sandbox */
  execute(code: string, context: ExecutionContext): Promise<unknown>;
}

/** Execution context passed to sandbox */
export interface ExecutionContext {
  input: unknown;
  env: Record<string, string>;
  fetch: typeof fetch;
}
