import type { BandDocument } from "@bands/format";
import {
  checkPermission,
  checkCliPermission,
  checkReadPermission,
  checkWritePermission,
  checkNetPermission,
  parseDuration,
} from "@bands/format";
import type { Sandbox, ExecutionContext } from "./types";

/**
 * Creates a sandbox that enforces band restrictions.
 * This is the core security enforcement layer.
 *
 * Uses Model A permission fields: band.allow, band.deny, band.limit
 */
export function createSandbox(band: BandDocument): Sandbox {
  const allowTools = band.allow?.tools ?? [];
  const denyTools = band.deny?.tools ?? [];

  const allowRead = band.allow?.read ?? [];
  const denyRead = band.deny?.read ?? [];

  const allowWrite = band.allow?.write ?? [];
  const denyWrite = band.deny?.write ?? [];

  const allowNet = band.allow?.net ?? [];
  const denyNet = band.deny?.net ?? [];

  const allowCli = band.allow?.cli ?? [];
  const denyCli = band.deny?.cli ?? [];

  return {
    canUseTool(tool: string): boolean {
      return checkPermission(tool, allowTools, denyTools);
    },

    canAccessPath(op: "read" | "write", path: string): boolean {
      if (op === "read") {
        return checkReadPermission(path, allowRead, denyRead);
      }
      return checkWritePermission(path, allowWrite, denyWrite);
    },

    canAccessNetwork(host: string): boolean {
      return checkNetPermission(host, allowNet, denyNet);
    },

    canRunCli(command: string): boolean {
      return checkCliPermission(command, allowCli, denyCli);
    },

    getAllowedEnv(): Record<string, string> {
      return {};
    },

    async execute(code: string, context: ExecutionContext): Promise<unknown> {
      const restrictedFetch = createRestrictedFetch(
        context.fetch,
        (host) => this.canAccessNetwork(host)
      );

      const rawTimeout = band.limit?.maxRuntimeMs;
      const timeout = (rawTimeout != null ? parseDuration(rawTimeout) : null) ?? 30000;

      return Promise.race([
        executeCode(code, {
          ...context,
          fetch: restrictedFetch,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout)
        ),
      ]);
    },
  };
}

/** Create a fetch that only allows requests to permitted hosts */
function createRestrictedFetch(
  baseFetch: typeof fetch,
  canAccess: (host: string) => boolean
): typeof fetch {
  const restrictedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL(input.url);
    const host = url.hostname;

    if (!canAccess(host)) {
      throw new Error(`Network access denied: ${host}`);
    }

    return baseFetch(input, init);
  };
  return Object.assign(restrictedFetch, baseFetch) as typeof fetch;
}

/** Execute code in sandbox - placeholder for real implementation */
async function executeCode(code: string, context: ExecutionContext): Promise<unknown> {
  return {
    executed: true,
    inputReceived: context.input,
  };
}
