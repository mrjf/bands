#!/usr/bin/env bun
/**
 * Run skill tests with concurrency control.
 *
 * Usage:
 *   bun scripts/test-skills.ts              # all skills
 *   bun scripts/test-skills.ts github       # one skill
 *   bun scripts/test-skills.ts github slack  # multiple skills
 */

import { readdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const MAX_CONCURRENT = 3;

const root = resolve(import.meta.dir, "..");
const skillsDir = join(root, "skills");

// Determine which skills to test
const args = process.argv.slice(2);
const skillNames = args.length
  ? args
  : readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "test")));

// Collect all test files across requested skills
const testFiles: string[] = [];
for (const skill of skillNames) {
  const testDir = join(skillsDir, skill, "test");
  if (!existsSync(testDir)) {
    console.error(`No test directory: skills/${skill}/test/`);
    process.exit(1);
  }
  const files = readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));
  for (const f of files) testFiles.push(join(testDir, f));
}

if (testFiles.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

console.log(`Running ${testFiles.length} test files (max ${MAX_CONCURRENT} concurrent)...\n`);
const start = performance.now();

// ── Result tracking ──

let totalPass = 0;
let totalFail = 0;
let anyFailed = false;

function printResult(name: string, code: number, combined: string) {
  const passMatch = combined.match(/(\d+) pass/);
  const failMatch = combined.match(/(\d+) fail/);
  const pass = passMatch ? parseInt(passMatch[1]) : 0;
  const fail = failMatch ? parseInt(failMatch[1]) : 0;
  totalPass += pass;
  totalFail += fail;

  const failed = code !== 0 || (pass === 0 && fail === 0);
  const icon = failed ? "✗" : "✓";
  console.log(`  ${icon} ${name} (${pass} pass${fail ? `, ${fail} fail` : ""})`);

  if (failed) {
    anyFailed = true;
    // Show all lines from "error:" through "(fail)", plus unhandled errors.
    // Bun format: error message, Expected/Received, stack, then (fail) line.
    const lines = combined.split("\n");
    const output: string[] = [];
    let inError = false;
    for (const l of lines) {
      const t = l.trimEnd();
      // Stop at bun's summary
      if (/^\s*\d+ pass/.test(t) || /^Ran \d+ test/.test(t)) break;
      if (t.includes("# Unhandled error") || t.includes("error:") || t.includes("Error:")) {
        inError = true;
      }
      if (inError) {
        output.push(t);
        if (t.includes("(fail)")) inError = false;
      }
    }
    for (const l of output) console.log(`    ${l}`);
  }
}

// ── Run with concurrency limit ──

async function runTest(file: string): Promise<void> {
  const name = file.replace(root + "/", "");
  const proc = Bun.spawn(["bun", "test", file], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  printResult(name, code as number, out + err);
}

// Simple concurrency pool
const queue = [...testFiles];
const running = new Set<Promise<void>>();

async function fillPool() {
  while (queue.length > 0 || running.size > 0) {
    // Fill up to MAX_CONCURRENT
    while (queue.length > 0 && running.size < MAX_CONCURRENT) {
      const file = queue.shift()!;
      const p = runTest(file).then(() => { running.delete(p); });
      running.add(p);
    }
    // Wait for at least one to finish before continuing
    if (running.size > 0) {
      await Promise.race(running);
    }
  }
}

await fillPool();

const elapsed = ((performance.now() - start) / 1000).toFixed(1);
console.log(`\n${totalPass} pass, ${totalFail} fail across ${testFiles.length} files [${elapsed}s]`);
process.exit(anyFailed ? 1 : 0);
