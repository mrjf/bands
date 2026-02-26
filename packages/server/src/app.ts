import { Hono } from "hono";
import { cors } from "hono/cors";
import type { BandDocument } from "@bands/format";
import type { BandRequest, BandResult, BandMetrics } from "./types";
import { createSandbox } from "./sandbox";

export interface BandAppOptions {
  /** Initial band config (can be updated via /init) */
  band?: BandDocument;
}

/**
 * Creates the Hono app that serves as the band execution server.
 * This is the same app deployed to Cloudflare Workers, Lima VM, Fly.io, etc.
 */
export function createBandApp(options: BandAppOptions = {}) {
  const app = new Hono();

  // State
  let currentBand: BandDocument | null = options.band ?? null;
  let sandbox = currentBand ? createSandbox(currentBand) : null;

  // Middleware
  app.use("*", cors());

  // Health check
  app.get("/health", (c) => {
    return c.json({
      ready: !!currentBand,
      band: currentBand?.band ?? null,
      version: currentBand?.version ?? null,
    });
  });

  // Initialize with band config
  app.post("/init", async (c) => {
    try {
      const band = await c.req.json<BandDocument>();

      if (!band.band || !band.version || !band.icon) {
        return c.json({ error: { code: "INVALID_BAND", message: "Missing required fields" } }, 400);
      }

      currentBand = band;
      sandbox = createSandbox(band);

      return c.json({ ok: true, band: band.band, version: band.version });
    } catch (err) {
      return c.json(
        { error: { code: "INIT_ERROR", message: err instanceof Error ? err.message : "Init failed" } },
        500
      );
    }
  });

  // Execute band (sync only)
  app.post("/", async (c) => {
    if (!currentBand || !sandbox) {
      return c.json({ error: { code: "NOT_INITIALIZED", message: "Call /init first" } }, 400);
    }

    const startTime = Date.now();

    try {
      const payload = await c.req.json();
      const inputBytes = JSON.stringify(payload).length;

      // Check input size limit
      const maxInput = currentBand.limits?.maxInputBytes;
      if (maxInput && inputBytes > maxInput) {
        return c.json(
          { error: { code: "INPUT_TOO_LARGE", message: `Input ${inputBytes} bytes exceeds limit ${maxInput}` } },
          400
        );
      }

      // Execute
      const result = await sandbox.execute(currentBand.body ?? "", {
        input: payload,
        env: sandbox.getAllowedEnv(),
        fetch,
      });

      const durationMs = Date.now() - startTime;
      const outputStr = JSON.stringify(result);
      const outputBytes = outputStr.length;

      // Check output size limit
      const maxOutput = currentBand.limits?.maxOutputBytes;
      if (maxOutput && outputBytes > maxOutput) {
        return c.json(
          { error: { code: "OUTPUT_TOO_LARGE", message: `Output ${outputBytes} bytes exceeds limit ${maxOutput}` } },
          400
        );
      }

      // Add metrics headers
      c.header("X-Band-Input-Bytes", String(inputBytes));
      c.header("X-Band-Output-Bytes", String(outputBytes));
      c.header("X-Band-Duration-Ms", String(durationMs));

      return c.json(result);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      c.header("X-Band-Duration-Ms", String(durationMs));

      return c.json(
        {
          error: {
            code: "EXECUTION_ERROR",
            message: err instanceof Error ? err.message : "Execution failed",
          },
        },
        500
      );
    }
  });

  // Get current band config (for debugging)
  app.get("/band", (c) => {
    if (!currentBand) {
      return c.json({ error: { code: "NOT_INITIALIZED", message: "No band loaded" } }, 400);
    }
    return c.json(currentBand);
  });

  return app;
}
