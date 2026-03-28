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
  "local-lima": "Lima VM not running — start with: limactl start bands-executor",
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
 * This should be called once, at the very end of the test run.
 */
export function printFinalSkipSummary(): void {
  if (skippedTargets.size === 0) return;

  const totalSkipped = [...skippedTargets.values()].reduce(
    (sum, r) => sum + r.count,
    0
  );

  const hasLima = skippedTargets.has("local-lima");
  const limaRecord = skippedTargets.get("local-lima");

  console.log("\n");
  console.log("!".repeat(80));
  console.log("!".repeat(80));
  console.log("");
  console.log(
    `  ⚠️  ${totalSkipped} INTEGRATION TESTS WERE SKIPPED ⚠️`
  );
  console.log("");

  for (const [target, record] of skippedTargets) {
    console.log(`  ${target}: ${record.count} tests skipped`);
    console.log(`    → ${record.reason}`);
    console.log(`    Suites affected: ${[...record.suites].join(", ")}`);
    console.log("");
  }

  if (hasLima && limaRecord) {
    console.log("─".repeat(80));
    console.log("");
    console.log("  LIMA IS CRITICAL — it is the primary sandbox executor.");
    console.log(
      `  ${limaRecord.count} tests ran against local-dangerously instead of a real VM.`
    );
    console.log("  These tests pass trivially without actual isolation enforcement.");
    console.log("");
    console.log("  To run the full suite:");
    console.log("    limactl start bands-executor");
    console.log("    bun test:all");
    console.log("");
  }

  console.log("!".repeat(80));
  console.log("!".repeat(80));
  console.log("");
}
