/**
 * Cloudflare Worker proxy for Band Containers.
 *
 * This is a thin proxy that routes all requests to the container
 * running the same band server as Lima. The Container class (backed
 * by a Durable Object) manages the container lifecycle.
 */

import { Container, getContainer } from "@cloudflare/containers";

export class BandContainer extends Container {
  defaultPort = 9000;
  sleepAfter = "60s";
}

export default {
  async fetch(request: Request, env: any) {
    const container = getContainer(env.BAND_CONTAINER, "band-executor");
    return container.fetch(request);
  },
};
