/**
 * ElevenLabs Skill — Direct integration tests
 *
 * Requires TEST_ELEVEN_LABS_TOKEN to be set.
 * These tests make real API calls to ElevenLabs.
 */

import { describe, expect, test } from "bun:test";
import { join } from "path";
import { existsSync } from "fs";
import { el, requireElevenLabsEnv, SKILL_ROOT, RESOURCES, TIMEOUT } from "./elevenlabs-helpers";

// ── Structure tests (no API key needed) ────────────────────────────────

describe("elevenlabs skill: structure", () => {
  test("SKILL.md exists", () => {
    expect(existsSync(join(SKILL_ROOT, "SKILL.md"))).toBe(true);
  });

  test("BAND.md exists", () => {
    expect(existsSync(join(SKILL_ROOT, "BAND.md"))).toBe(true);
  });

  test("all scripts have resource dirs with run.sh", () => {
    const scripts = ["tts", "voice-list", "voice-get", "sfx", "user-info"];
    for (const script of scripts) {
      expect(existsSync(join(RESOURCES, script, "run.sh"))).toBe(true);
    }
  });

  test("all scripts have input schemas", () => {
    const scripts = ["tts", "voice-list", "voice-get", "sfx", "user-info"];
    for (const script of scripts) {
      expect(existsSync(join(SKILL_ROOT, "schemas", "input", `${script}.json`))).toBe(true);
    }
  });
});

// ── Voice tests ────────────────────────────────────────────────────────

describe("elevenlabs skill: voices", () => {
  let firstVoiceId: string;

  test(
    "voice-list returns available voices",
    async () => {
      requireElevenLabsEnv();
      const result = await el("voice-list");
      if (!result.success) throw new Error(`voice-list failed: ${result.error}`);
      const data = result.data as any[];
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].voice_id).toBeDefined();
      expect(data[0].name).toBeDefined();
      firstVoiceId = data[0].voice_id;
    },
    TIMEOUT
  );

  test(
    "voice-get returns voice details",
    async () => {
      requireElevenLabsEnv();
      if (!firstVoiceId) {
        const listResult = await el("voice-list");
        if (!listResult.success) throw new Error(`voice-list failed: ${listResult.error}`);
        firstVoiceId = (listResult.data as any[])[0].voice_id;
      }

      const result = await el("voice-get", { voice_id: firstVoiceId });
      if (!result.success) throw new Error(`voice-get failed: ${result.error}`);
      const data = result.data as any;
      expect(data.voice_id).toBe(firstVoiceId);
      expect(data.name).toBeDefined();
    },
    TIMEOUT
  );
});

// ── Account tests ──────────────────────────────────────────────────────

describe("elevenlabs skill: account", () => {
  test(
    "user-info returns subscription details",
    async () => {
      requireElevenLabsEnv();
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

// ── TTS tests ──────────────────────────────────────────────────────────

describe("elevenlabs skill: text-to-speech", () => {
  test(
    "tts generates audio from text",
    async () => {
      requireElevenLabsEnv();
      const listResult = await el("voice-list");
      if (!listResult.success) throw new Error(`voice-list failed: ${listResult.error}`);
      const voiceId = (listResult.data as any[])[0].voice_id;

      const result = await el("tts", {
        voice_id: voiceId,
        text: "Hello, this is a test.",
        output_path: "/tmp/elevenlabs-test-output.mp3",
      });
      if (!result.success) throw new Error(`tts failed: ${result.error}`);
      const data = result.data as any;
      expect(data.success).toBe(true);
      expect(data.size_bytes).toBeGreaterThan(0);
    },
    TIMEOUT
  );
});
