/**
 * Centralized skip tracker for integration tests.
 *
 * Tracks which execution targets were unavailable and how many
 * tests were skipped per target, then prints a loud final summary.
 */

type SkipRecord = {
  reason: string;
  count: number;
  suites: Set<string>;
};

const skippedTargets = new Map<string, SkipRecord>();

const TARGET_REASONS: Record<string, string> = {
  "local-lima": "Lima VM not running -- start with: limactl start bands-executor",
  cloudflare: "Wrangler not installed or no network/credentials",
};

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
}

/**
 * Print a final summary of all skipped tests.
 * Uses process.stderr.write to avoid buffering issues with bun test.
 */
export function printFinalSkipSummary(): void {
  if (skippedTargets.size === 0) return;

  const totalSkipped = [...skippedTargets.values()].reduce(
    (sum, r) => sum + r.count,
    0
  );

  const hasLima = skippedTargets.has("local-lima");
  const limaRecord = skippedTargets.get("local-lima");

  const lines: string[] = [
    "",
    "!".repeat(80),
    "!".repeat(80),
    "",
    `  WARNING: ${totalSkipped} INTEGRATION TESTS WERE SKIPPED`,
    "",
  ];

  for (const [target, record] of skippedTargets) {
    lines.push(`  ${target}: ${record.count} tests skipped`);
    lines.push(`    -> ${record.reason}`);
    lines.push(`    Suites affected: ${[...record.suites].join(", ")}`);
    lines.push("");
  }

  if (hasLima && limaRecord) {
    lines.push("-".repeat(80));
    lines.push("");
    lines.push("  LIMA IS CRITICAL -- it is the primary sandbox executor.");
    lines.push(
      `  ${limaRecord.count} tests ran against local-dangerously instead of a real VM.`
    );
    lines.push("  These tests pass trivially without actual isolation enforcement.");
    lines.push("");
    lines.push("  To run the full suite:");
    lines.push("    limactl start bands-executor");
    lines.push("    bun test:all");
    lines.push("");
  }

  lines.push("!".repeat(80));
  lines.push("!".repeat(80));
  lines.push("");

  process.stderr.write(lines.join("\n"));
}
