import type { BandDocument } from "@bands/format";

/** Compiled band ready for execution */
export interface CompiledBand {
  band: BandDocument;
  limits: {
    maxInputBytes: number;
    maxOutputBytes: number;
    maxRuntimeMs: number;
    maxCostDollars: number;
  };
  firewall: {
    allowedDns: Set<string>;
    allowedIp: Set<string>;
    deniedIp: Set<string>;
    defaultEgress: "allow" | "deny";
  };
}

/** Runtime metrics for a single request */
export interface RequestMetrics {
  inputBytes: number;
  outputBytes: number;
  startTime: number;
}

/** Standard error response */
export interface BandError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Error codes */
export const ErrorCodes = {
  // Limit errors
  INPUT_TOO_LARGE: "INPUT_TOO_LARGE",
  OUTPUT_TOO_LARGE: "OUTPUT_TOO_LARGE",
  TIMEOUT: "TIMEOUT",
  COST_EXCEEDED: "COST_EXCEEDED",

  // Network errors
  EGRESS_DENIED: "EGRESS_DENIED",

  // Internal errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_READY: "NOT_READY",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
