/**
 * Centralized skip tracker for integration tests.
 *
 * Tracks which execution targets were unavailable and how many
 * tests were skipped per target. Writes a summary file that
 * print-skip-summary.ts reads after the test run completes.
 */

import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync } from "fs";

type SkipRecord = {
  reason: string;
  count: number;
  suites: string[];
};

const skippedTargets = new Map<
  string,
  { reason: string; count: number; suites: Set<string> }
>();

const TARGET_REASONS: Record<string, string> = {
  "local-lima": "Lima VM not running -- start with: limactl start bands-executor",
  cloudflare: "Wrangler not installed or no network/credentials",
};

export const SKIP_SUMMARY_PATH = join(tmpdir(), "bands-skip-summary.json");

/**
 * Register a skipped test for a target.
 * Call this each time a test is skipped due to an unavailable executor.
 */
export function trackSkip(target: string, suite: string): void {
  const existing = skippedTargets.get(target);
  if (existing) {
    existing.count++;
    existing.suites.add(suite);
  } else {
    skippedTargets.set(target, {
      reason: TARGET_REASONS[target] ?? "Executor not available",
      count: 1,
      suites: new Set([suite]),
    });
  }

  // Write summary file on every skip so it's always up to date
  const data: Record<string, SkipRecord> = {};
  for (const [t, r] of skippedTargets) {
    data[t] = { reason: r.reason, count: r.count, suites: [...r.suites] };
  }
  writeFileSync(SKIP_SUMMARY_PATH, JSON.stringify(data));
}
