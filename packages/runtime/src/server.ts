import { Hono } from "hono";
import type { BandDocument } from "@bands/format";
import type { CompiledBand, RequestMetrics, BandError } from "./types";
import { ErrorCodes } from "./types";
import { compileBand } from "./loader";
import { validateInput, validateOutput, checkTimeout } from "./validator";
import { createRestrictedFetch } from "./firewall";

export interface RuntimeState {
  compiled: CompiledBand | null;
  ready: boolean;
  error: string | null;
}

/** Handler context for request processing */
export interface HandlerContext {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  metrics: RequestMetrics;
}

/**
 * Create a Hono app configured for a band runtime.
 * The app exposes a single POST endpoint that enforces all band constraints.
 */
export function createBandServer(
  handler: (input: unknown, ctx: HandlerContext) => Promise<unknown>
) {
  const app = new Hono<{ Variables: { state: RuntimeState } }>();

  // Runtime state - will be initialized when band is loaded
  const state: RuntimeState = {
    compiled: null,
    ready: false,
    error: null,
  };

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({
      ready: state.ready,
      band: state.compiled?.band.band ?? null,
      error: state.error,
    });
  });

  // Initialize with a band configuration
  app.post("/init", async (c) => {
    try {
      const band = await c.req.json<BandDocument>();
      state.compiled = compileBand(band);
      state.ready = true;
      state.error = null;
      return c.json({ ok: true, band: band.band });
    } catch (err) {
      state.error = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: state.error }, 500);
    }
  });

  // Main execution endpoint (sync only)
  app.post("/", async (c) => {
    if (!state.ready || !state.compiled) {
      return c.json<BandError>(
        {
          error: {
            code: ErrorCodes.NOT_READY,
            message: "Runtime not initialized. POST to /init first.",
          },
        },
        503
      );
    }

    const compiled = state.compiled;

    // Initialize metrics
    const metrics: RequestMetrics = {
      inputBytes: 0,
      outputBytes: 0,
      startTime: Date.now(),
    };

    // Parse input
    let input: unknown;
    try {
      const rawBody = await c.req.text();
      metrics.inputBytes = new TextEncoder().encode(rawBody).length;
      input = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return c.json<BandError>(
        {
          error: {
            code: ErrorCodes.INPUT_TOO_LARGE,
            message: "Invalid JSON input",
          },
        },
        400
      );
    }

    const inputError = validateInput(compiled, input, metrics);
    if (inputError) {
      return c.json(inputError, 400);
    }

    // Create restricted fetch
    const restrictedFetch = createRestrictedFetch(compiled);

    // Execute handler
    try {
      const result = await handler(input, {
        fetch: restrictedFetch,
        metrics,
      });

      // Check timeout
      const timeoutError = checkTimeout(compiled, metrics);
      if (timeoutError) {
        return c.json(timeoutError, 408);
      }

      // Validate output
      const outputJson = JSON.stringify(result);
      metrics.outputBytes = new TextEncoder().encode(outputJson).length;

      const outputError = validateOutput(compiled, metrics.outputBytes);
      if (outputError) {
        return c.json(outputError, 500);
      }

      // Return with metrics headers
      return c.json(result, 200, {
        "X-Band-Input-Bytes": String(metrics.inputBytes),
        "X-Band-Output-Bytes": String(metrics.outputBytes),
        "X-Band-Duration-Ms": String(Date.now() - metrics.startTime),
      });
    } catch (err) {
      return c.json<BandError>(
        {
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: err instanceof Error ? err.message : String(err),
          },
        },
        500
      );
    }
  });

  return { app, state };
}
