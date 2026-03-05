#!/usr/bin/env bun
/**
 * Run skill tests with concurrency control.
 *
 * Usage:
 *   bun scripts/test-skills.ts                        # all skills, all tests
 *   bun scripts/test-skills.ts github                 # one skill, all tests
 *   bun scripts/test-skills.ts github --direct        # only github-skill-*.test.ts (no agent)
 *   bun scripts/test-skills.ts github --agent         # only agent-*.test.ts
 *   bun scripts/test-skills.ts github slack           # multiple skills
 */

import { readdirSync, existsSync } from "fs";
import { join, resolve, basename } from "path";

const MAX_CONCURRENT = 3;

const root = resolve(import.meta.dir, "..");
const skillsDir = join(root, "skills");

// Parse args: skill names and flags
const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter((a) => a.startsWith("--"));
const skillArgs = rawArgs.filter((a) => !a.startsWith("--"));

const filterDirect = flags.includes("--direct");
const filterAgent = flags.includes("--agent");

const skillNames = skillArgs.length
  ? skillArgs
  : readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "test")));

// Collect all test files across requested skills
const testFiles: string[] = [];
for (const skill of skillNames) {
  const testDir = join(skillsDir, skill, "test");
  if (!existsSync(testDir)) {
    console.error(`No test directory: skills/${skill}/test/`);
    process.exit(1);
  }
  let files = readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));

  if (filterDirect) {
    files = files.filter((f) => !f.startsWith("agent-"));
  } else if (filterAgent) {
    files = files.filter((f) => f.startsWith("agent-"));
  }

  for (const f of files) testFiles.push(join(testDir, f));
}

if (testFiles.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

const label = filterDirect ? "direct" : filterAgent ? "agent" : "all";
console.log(`Running ${testFiles.length} ${label} test files (max ${MAX_CONCURRENT} concurrent)...\n`);
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
