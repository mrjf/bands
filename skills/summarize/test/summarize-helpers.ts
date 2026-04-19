/**
 * Shared helpers for summarize banded skill tests.
 */

import { join, resolve } from "path";
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";

// ── Load .env ──────────────────────────────────────────────────────────

function loadEnv() {
  const possiblePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "packages", "runtime", ".env"),
    resolve(__dirname, "..", "..", "..", "packages", "runtime", ".env"),
    resolve(__dirname, "..", "..", "..", ".env"),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      for (const line of readFileSync(p, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const key = trimmed.slice(0, eq);
            const val = trimmed.slice(eq + 1);
            if (!process.env[key]) process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

loadEnv();

// ── Config ─────────────────────────────────────────────────────────────

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function findSkillRoot(): string {
  const candidates = [
    resolve(__dirname, ".."),
    resolve(process.cwd(), "skills", "summarize"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "SKILL.md"))) return c;
  }
  throw new Error("Cannot find skills/summarize");
}

export const SKILL_ROOT = findSkillRoot();
export const RESOURCES = join(SKILL_ROOT, "scripts", "resources");
export const TIMEOUT = 60_000;

/**
 * Require ANTHROPIC_API_KEY.
 */
export function requireAnthropicEnv(): string {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Missing required env var: ANTHROPIC_API_KEY");
  }
  return ANTHROPIC_API_KEY;
}

/**
 * Execute the summarize skill script with JSON input.
 */
export async function summarize(input: { document: string; guidance?: string }) {
  requireAnthropicEnv();
  const tempDir = mkdtempSync(join(tmpdir(), "summarize-test-"));
  const inputPath = join(tempDir, "input.json");
  writeFileSync(inputPath, JSON.stringify(input));

  try {
    return await bandExec({
      resourceDir: join(RESOURCES, "summarize"),
      args: {},
      inputPath,
      skillRoot: SKILL_ROOT,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
