/**
 * Cloudflare Worker entry point for Band Runtime.
 *
 * This worker exposes a single endpoint that executes according to
 * the band configuration. The band is loaded via /init or from
 * environment variable BAND_CONFIG.
 */

import { createBandServer } from "./server";

// Create the band server with a placeholder handler
// In production, the handler would be injected during deployment
const { app, state } = createBandServer(async (input, ctx) => {
  // This is a placeholder - real implementations would:
  // 1. Load skills/tools referenced in the band
  // 2. Execute them with the restricted fetch
  // 3. Return the result

  // For now, just echo the input back
  return {
    echo: input,
    timestamp: Date.now(),
  };
});

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Auto-initialize from env if not already ready
    if (!state.ready && env.BAND_CONFIG) {
      try {
        const band = JSON.parse(env.BAND_CONFIG);
        const { compileBand } = await import("./loader");
        state.compiled = await compileBand(band);
        state.ready = true;
      } catch (err) {
        state.error = err instanceof Error ? err.message : String(err);
      }
    }

    return app.fetch(request, env, ctx);
  },
};
