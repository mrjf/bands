/**
 * Cloudflare Worker entry point
 *
 * This is the same band server app, exported in Worker format.
 */

import { createBandApp } from "./app";

const app = createBandApp();

export default {
  fetch: app.fetch,
};
