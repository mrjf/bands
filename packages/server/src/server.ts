/**
 * Standalone Bun server entry point
 *
 * Run with: bun run src/server.ts
 * Or: PORT=9000 bun run src/server.ts
 */

import { createBandApp } from "./app";

const port = parseInt(process.env.PORT ?? "9000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const app = createBandApp();

console.log(`🎸 Band server listening on http://${host}:${port}`);

export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
