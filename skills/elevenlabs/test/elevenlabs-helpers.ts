/**
 * Shared helpers for ElevenLabs banded skill tests.
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

export const ELEVENLABS_TOKEN = process.env.TEST_ELEVEN_LABS_TOKEN;

// Map TEST_ELEVEN_LABS_TOKEN → ELEVENLABS_API_KEY for scripts
if (ELEVENLABS_TOKEN) {
  process.env.ELEVENLABS_API_KEY = ELEVENLABS_TOKEN;
}

function findSkillRoot(): string {
  const candidates = [
    resolve(__dirname, ".."),
    resolve(process.cwd(), "skills", "elevenlabs"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "SKILL.md"))) return c;
  }
  throw new Error("Cannot find skills/elevenlabs");
}

export const SKILL_ROOT = findSkillRoot();
export const RESOURCES = join(SKILL_ROOT, "scripts", "resources");
export const TIMEOUT = 60_000;

/**
 * Require TEST_ELEVEN_LABS_TOKEN.
 */
export function requireElevenLabsEnv(): string {
  if (!ELEVENLABS_TOKEN) {
    throw new Error("Missing required env var: TEST_ELEVEN_LABS_TOKEN");
  }
  return ELEVENLABS_TOKEN;
}

/**
 * Execute an ElevenLabs skill script with JSON input.
 */
export async function el(script: string, input: Record<string, unknown> = {}) {
  requireElevenLabsEnv();
  const tempDir = mkdtempSync(join(tmpdir(), "el-test-"));
  const inputPath = join(tempDir, "input.json");
  writeFileSync(inputPath, JSON.stringify(input));

  try {
    return await bandExec({
      resourceDir: join(RESOURCES, script),
      args: {},
      inputPath,
      skillRoot: SKILL_ROOT,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
