/**
 * Utilities for parsing and formatting human-readable units.
 *
 * Bytes: 1k, 2m, 3g, 4t (base-2: KiB, MiB, GiB, TiB)
 * Duration: 1ms, 10s, 30m, 1h
 */

const BYTE_UNITS: Record<string, number> = {
  "": 1,
  k: 1024,
  m: 1024 * 1024,
  g: 1024 * 1024 * 1024,
  t: 1024 * 1024 * 1024 * 1024,
};

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
};

/**
 * Parse a byte value like "1k", "2m", "500" into a number of bytes.
 * Returns null if invalid.
 */
export function parseBytes(value: string | number): number | null {
  if (typeof value === "number") return value;

  const str = value.trim().toLowerCase();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*([kmgt]?)$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2] || "";
  const multiplier = BYTE_UNITS[unit];

  if (multiplier === undefined) return null;
  return Math.round(num * multiplier);
}

/**
 * Format bytes as a human-readable string.
 * Uses the largest unit that results in a value >= 1.
 */
export function formatBytes(bytes: number | string): string {
  if (typeof bytes === "string") return bytes;
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}k`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}m`;
  if (bytes < 1024 * 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))}g`;
  return `${Math.round(bytes / (1024 * 1024 * 1024 * 1024))}t`;
}

/**
 * Parse a duration value like "100ms", "10s", "5m" into milliseconds.
 * Returns null if invalid.
 */
export function parseDuration(value: string | number): number | null {
  if (typeof value === "number") return value;

  const str = value.trim().toLowerCase();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2] || "ms";
  const multiplier = DURATION_UNITS[unit];

  if (multiplier === undefined) return null;
  return Math.round(num * multiplier);
}

/**
 * Format milliseconds as a human-readable string.
 * Uses the largest unit that results in a value >= 1.
 */
export function formatDuration(ms: number | string): string {
  if (typeof ms === "string") return ms;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))}m`;
  return `${Math.round(ms / (60 * 60 * 1000))}h`;
}

/**
 * Parse a cost value like "$0.10", "0.10" into a number.
 * Returns null if invalid.
 */
export function parseCost(value: string | number): number | null {
  if (typeof value === "number") return value;

  const str = value.trim().replace(/^\$/, "");
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Format a cost as a dollar string.
 */
export function formatCost(cost: number | string): string {
  if (typeof cost === "string") return cost.startsWith("$") ? cost : `$${cost}`;
  return `$${cost.toFixed(2)}`;
}
