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
  // Build firewall rules from Model A permission fields
  const firewall = {
    allowedDns: new Set<string>(band.allow?.net ?? []),
    allowedIp: new Set<string>(),
    deniedIp: new Set<string>(),
    defaultEgress: "deny" as "allow" | "deny",
  };

  // Merge limits with defaults
  const limits = {
    maxInputBytes: band.limit?.maxInputBytes ?? DEFAULT_LIMITS.maxInputBytes,
    maxOutputBytes: band.limit?.maxOutputBytes ?? DEFAULT_LIMITS.maxOutputBytes,
    maxRuntimeMs: band.limit?.maxRuntimeMs ?? DEFAULT_LIMITS.maxRuntimeMs,
    maxCostDollars: band.limit?.maxCostDollars ?? DEFAULT_LIMITS.maxCostDollars,
  };

  return {
    band,
    limits,
    firewall,
  };
}
