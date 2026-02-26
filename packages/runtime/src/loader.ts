import type { BandDocument } from "@bands/format";
import type { CompiledBand } from "./types";

/** Default limits when not specified */
const DEFAULT_LIMITS = {
  maxInputBytes: 1024 * 1024, // 1MB
  maxOutputBytes: 10 * 1024 * 1024, // 10MB
  maxRuntimeMs: 30000, // 30s
  maxCostDollars: 1,
};

/**
 * Compile a BandDocument into a runtime-ready form.
 * Prepares firewall rules and merges limits with defaults.
 */
export function compileBand(band: BandDocument): CompiledBand {
  // Build firewall rules from network capabilities
  const egress = band.capabilities?.network?.egress;
  const firewall = {
    allowedDns: new Set<string>(egress?.allow_dns ?? []),
    allowedIp: new Set<string>(egress?.allow_ip ?? []),
    deniedIp: new Set<string>(egress?.deny_ip ?? []),
    defaultEgress: (egress?.default ?? "deny") as "allow" | "deny",
  };

  // Merge limits with defaults
  const limits = {
    maxInputBytes: band.limits?.maxInputBytes ?? DEFAULT_LIMITS.maxInputBytes,
    maxOutputBytes: band.limits?.maxOutputBytes ?? DEFAULT_LIMITS.maxOutputBytes,
    maxRuntimeMs: band.limits?.maxRuntimeMs ?? DEFAULT_LIMITS.maxRuntimeMs,
    maxCostDollars: band.limits?.maxCostDollars ?? DEFAULT_LIMITS.maxCostDollars,
  };

  return {
    band,
    limits,
    firewall,
  };
}
