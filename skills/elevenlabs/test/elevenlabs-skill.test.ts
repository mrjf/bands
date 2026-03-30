/**
 * ElevenLabs Skill — Integration tests
 *
 * Requires ELEVENLABS_API_KEY to be set.
 * These tests make real API calls to ElevenLabs.
 */

import { describe, expect, test } from "bun:test";
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

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
if (ELEVENLABS_KEY) {
  process.env.ELEVENLABS_API_KEY = ELEVENLABS_KEY;
}

function findSkillRoot(): string {
  const candidates = [
    resolve(__dirname, ".."),
    resolve(process.cwd(), "skills", "elevenlabs"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "SKILL.md"))) return c;
  }
  throw new Error(`Cannot find skills/elevenlabs`);
}

const SKILL_ROOT = findSkillRoot();
const RESOURCES = join(SKILL_ROOT, "scripts", "resources");
const TIMEOUT = 30_000;

function requireApiKey(): string {
  if (!ELEVENLABS_KEY) {
    throw new Error("Missing required env var: ELEVENLABS_API_KEY");
  }
  return ELEVENLABS_KEY;
}

async function el(script: string, input: Record<string, unknown> = {}) {
  requireApiKey();
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

// ── Tests ──────────────────────────────────────────────────────────────

describe("elevenlabs skill: voices", () => {
  test(
    "lists available voices",
    async () => {
      const result = await el("voice-list");
      if (!result.success) throw new Error(`voice-list failed: ${result.error}`);
      const data = result.data as any[];
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].voice_id).toBeDefined();
      expect(data[0].name).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "gets voice details",
    async () => {
      // First get a voice ID
      const listResult = await el("voice-list");
      if (!listResult.success) throw new Error(`voice-list failed: ${listResult.error}`);
      const voices = listResult.data as any[];
      const voiceId = voices[0].voice_id;

      const result = await el("voice-get", { voice_id: voiceId });
      if (!result.success) throw new Error(`voice-get failed: ${result.error}`);
      const data = result.data as any;
      expect(data.voice_id).toBe(voiceId);
      expect(data.name).toBeDefined();
    },
    TIMEOUT
  );
});

describe("elevenlabs skill: account", () => {
  test(
    "gets user info",
    async () => {
      const result = await el("user-info");
      if (!result.success) throw new Error(`user-info failed: ${result.error}`);
      const data = result.data as any;
      expect(data.tier).toBeDefined();
      expect(typeof data.character_count).toBe("number");
      expect(typeof data.character_limit).toBe("number");
    },
    TIMEOUT
  );
});

describe("elevenlabs skill: structure", () => {
  test("SKILL.md exists", () => {
    expect(existsSync(join(SKILL_ROOT, "SKILL.md"))).toBe(true);
  });

  test("BAND.md exists", () => {
    expect(existsSync(join(SKILL_ROOT, "BAND.md"))).toBe(true);
  });

  test("all documented scripts have resource dirs", () => {
    const scripts = ["tts", "voice-list", "voice-get", "sfx", "user-info"];
    for (const script of scripts) {
      expect(existsSync(join(RESOURCES, script, "run.sh"))).toBe(true);
    }
  });

  test("all documented scripts have input schemas", () => {
    const scripts = ["tts", "voice-list", "voice-get", "sfx", "user-info"];
    for (const script of scripts) {
      expect(existsSync(join(SKILL_ROOT, "schemas", "input", `${script}.json`))).toBe(true);
    }
  });
});
