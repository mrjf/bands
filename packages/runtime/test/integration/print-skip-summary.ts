#!/usr/bin/env bun
/**
 * Print the skip summary after bun test completes.
 * Run as: bun test/integration/print-skip-summary.ts
 *
 * Reads the summary file written by skip-tracker.ts during the test run.
 * Exits 0 regardless — this is informational, not a gate.
 */

import { readFileSync, unlinkSync } from "fs";
import { SKIP_SUMMARY_PATH } from "./skip-tracker";

type SkipRecord = {
  reason: string;
  count: number;
  suites: string[];
};

let data: Record<string, SkipRecord>;
try {
  data = JSON.parse(readFileSync(SKIP_SUMMARY_PATH, "utf8"));
  unlinkSync(SKIP_SUMMARY_PATH);
} catch {
  // No summary file = no skips
  process.exit(0);
}

const targets = Object.entries(data);
if (targets.length === 0) process.exit(0);

const totalSkipped = targets.reduce((sum, [, r]) => sum + r.count, 0);
const limaRecord = data["local-lima"];

const lines: string[] = [
  "",
  "!".repeat(80),
  "!".repeat(80),
  "",
  `  WARNING: ${totalSkipped} INTEGRATION TESTS WERE SKIPPED`,
  "",
];

for (const [target, record] of targets) {
  lines.push(`  ${target}: ${record.count} tests skipped`);
  lines.push(`    -> ${record.reason}`);
  lines.push(`    Suites affected: ${record.suites.join(", ")}`);
  lines.push("");
}

if (limaRecord) {
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
