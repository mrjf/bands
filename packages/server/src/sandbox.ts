import type { BandDocument } from "@bands/format";
import type { Sandbox, ExecutionContext } from "./types";

/**
 * Creates a sandbox that enforces band restrictions.
 * This is the core security enforcement layer.
 */
export function createSandbox(band: BandDocument): Sandbox {
  const caps = band.capabilities ?? {};
  const limits = band.limits ?? {};

  // Pre-compute allowed tools
  const allowedTools = new Set(caps.tools?.allow ?? []);
  const deniedTools = new Set(caps.tools?.deny ?? []);
  const toolDefault = caps.tools?.default ?? "deny";

  // Pre-compute allowed filesystem paths
  const fsAllow = caps.filesystem?.allow ?? [];
  const fsDeny = caps.filesystem?.deny ?? [];
  const fsDefault = caps.filesystem?.default ?? "deny";

  // Pre-compute allowed network hosts
  const netEgress = caps.network?.egress ?? {};
  const allowedDns = new Set(netEgress.allow_dns ?? []);
  const allowedIp = new Set(netEgress.allow_ip ?? []);
  const deniedIp = new Set(netEgress.deny_ip ?? []);
  const netDefault = netEgress.default ?? "deny";

  return {
    canUseTool(tool: string): boolean {
      if (deniedTools.has(tool)) return false;
      if (allowedTools.has(tool)) return true;
      return toolDefault === "allow";
    },

    canAccessPath(op: "read" | "write", path: string): boolean {
      // Check deny list first
      for (const pattern of fsDeny) {
        const p = typeof pattern === "string" ? pattern : `${pattern}`;
        if (matchFsPattern(op, path, p)) return false;
      }
      // Check allow list
      for (const pattern of fsAllow) {
        const p = typeof pattern === "string" ? pattern : `${pattern}`;
        if (matchFsPattern(op, path, p)) return true;
      }
      return fsDefault === "allow";
    },

    canAccessNetwork(host: string): boolean {
      // Check denied IPs first
      if (deniedIp.has(host)) return false;

      // Check allowed
      if (allowedIp.has(host)) return true;

      // Check DNS patterns (supports wildcards like *.github.com)
      for (const pattern of allowedDns) {
        if (matchDnsPattern(host, pattern)) return true;
      }

      return netDefault === "allow";
    },

    getAllowedEnv(): Record<string, string> {
      // Only expose explicitly allowed env vars
      // For now, return empty - bands must declare what they need
      return {};
    },

    async execute(code: string, context: ExecutionContext): Promise<unknown> {
      // Create restricted fetch
      const restrictedFetch = createRestrictedFetch(
        context.fetch,
        (host) => this.canAccessNetwork(host)
      );

      // Execute with timeout
      const timeout = limits.maxRuntimeMs ?? 30000;

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

/** Match filesystem pattern like "read:path" or "write:/tmp/file" */
function matchFsPattern(op: "read" | "write", path: string, pattern: string): boolean {
  // Pattern format: "op:glob" or just "glob" (matches any op)
  const [patternOp, ...rest] = pattern.split(":");
  const glob = rest.length > 0 ? rest.join(":") : patternOp;
  const targetOp = rest.length > 0 ? patternOp : null;

  if (targetOp && targetOp !== op) return false;

  return matchGlob(path, glob);
}

/** Match DNS pattern (supports * wildcard) */
function matchDnsPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".github.com"
    return host.endsWith(suffix) || host === pattern.slice(2);
  }
  return host === pattern;
}

/** Simple glob matching */
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
        .replace(/\*/g, "[^/]*")
        .replace(/<<<DOUBLESTAR>>>/g, ".*")
        .replace(/\?/g, ".") +
      "$"
  );
  return regex.test(path);
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
  // Copy over any additional properties from the original fetch
  return Object.assign(restrictedFetch, baseFetch) as typeof fetch;
}

/** Execute code in sandbox - placeholder for real implementation */
async function executeCode(code: string, context: ExecutionContext): Promise<unknown> {
  // This is a simplified placeholder
  // Real implementation would:
  // 1. Parse the skill instructions from the band body
  // 2. Execute scripts with restricted APIs
  // 3. Return results

  return {
    executed: true,
    inputReceived: context.input,
  };
}
