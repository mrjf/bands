import type { CompiledBand, BandError } from "./types";
import { ErrorCodes } from "./types";

/**
 * Check if an outbound request is allowed by the firewall rules.
 * Returns null if allowed, BandError if denied.
 */
export function checkEgress(
  compiled: CompiledBand,
  url: string
): BandError | null {
  const { firewall } = compiled;

  let hostname: string;
  let ip: string | null = null;

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;

    // Check if hostname is an IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      ip = hostname;
    }
  } catch {
    return {
      error: {
        code: ErrorCodes.EGRESS_DENIED,
        message: `Invalid URL: ${url}`,
      },
    };
  }

  // Check explicit deny list first (IP only)
  if (ip && firewall.deniedIp.has(ip)) {
    return {
      error: {
        code: ErrorCodes.EGRESS_DENIED,
        message: `Egress to IP ${ip} is explicitly denied`,
      },
    };
  }

  // Check for CIDR matches in deny list
  for (const deniedCidr of firewall.deniedIp) {
    if (deniedCidr.includes("/") && ip && matchesCidr(ip, deniedCidr)) {
      return {
        error: {
          code: ErrorCodes.EGRESS_DENIED,
          message: `Egress to IP ${ip} matches denied CIDR ${deniedCidr}`,
        },
      };
    }
  }

  // Check allow lists
  if (firewall.allowedDns.has(hostname)) {
    return null; // Explicitly allowed by DNS
  }

  if (ip && firewall.allowedIp.has(ip)) {
    return null; // Explicitly allowed by IP
  }

  // Check for CIDR matches in allow list
  if (ip) {
    for (const allowedCidr of firewall.allowedIp) {
      if (allowedCidr.includes("/") && matchesCidr(ip, allowedCidr)) {
        return null; // Matches allowed CIDR
      }
    }
  }

  // Check wildcard DNS patterns (e.g., "*.example.com")
  for (const pattern of firewall.allowedDns) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      if (hostname.endsWith(suffix) || hostname === pattern.slice(2)) {
        return null;
      }
    }
  }

  // Fall back to default policy
  if (firewall.defaultEgress === "allow") {
    return null;
  }

  return {
    error: {
      code: ErrorCodes.EGRESS_DENIED,
      message: `Egress to ${hostname} is not allowed. Default policy: deny`,
    },
  };
}

/**
 * Simple CIDR matching for IPv4.
 */
function matchesCidr(ip: string, cidr: string): boolean {
  const [cidrIp, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipNum = ipToNumber(ip);
  const cidrNum = ipToNumber(cidrIp);

  if (ipNum === null || cidrNum === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (cidrNum & mask);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    result = (result << 8) | num;
  }
  return result >>> 0;
}

/**
 * Create a fetch wrapper that enforces firewall rules.
 */
export function createRestrictedFetch(
  compiled: CompiledBand
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    const error = checkEgress(compiled, url);
    if (error) {
      throw new Error(`${error.error.code}: ${error.error.message}`);
    }

    return fetch(input, init);
  };
}
