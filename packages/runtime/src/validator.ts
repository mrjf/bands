import type { CompiledBand, BandError, RequestMetrics } from "./types";
import { ErrorCodes } from "./types";

/** Validate input against limits */
export function validateInput(
  compiled: CompiledBand,
  _body: unknown,
  metrics: RequestMetrics
): BandError | null {
  // Check input size limit
  if (metrics.inputBytes > compiled.limits.maxInputBytes) {
    return {
      error: {
        code: ErrorCodes.INPUT_TOO_LARGE,
        message: `Input size ${metrics.inputBytes} bytes exceeds limit of ${compiled.limits.maxInputBytes} bytes`,
      },
    };
  }

  return null;
}

/** Validate output against limits */
export function validateOutput(
  compiled: CompiledBand,
  outputBytes: number
): BandError | null {
  // Check output size limit
  if (outputBytes > compiled.limits.maxOutputBytes) {
    return {
      error: {
        code: ErrorCodes.OUTPUT_TOO_LARGE,
        message: `Output size ${outputBytes} bytes exceeds limit of ${compiled.limits.maxOutputBytes} bytes`,
      },
    };
  }

  return null;
}

/** Check if runtime limit has been exceeded */
export function checkTimeout(
  compiled: CompiledBand,
  metrics: RequestMetrics
): BandError | null {
  const elapsed = Date.now() - metrics.startTime;
  const limit = compiled.limits.maxRuntimeMs;

  if (elapsed > limit) {
    return {
      error: {
        code: ErrorCodes.TIMEOUT,
        message: `Execution time ${elapsed}ms exceeds limit of ${limit}ms`,
      },
    };
  }

  return null;
}
