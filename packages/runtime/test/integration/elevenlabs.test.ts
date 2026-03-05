/**
 * Full Integration Tests for the ElevenLabs skill band.
 *
 * These tests execute real API calls against the ElevenLabs API.
 * They require ELEVENLABS_API_KEY to be set in the environment or .env file.
 *
 * Tests SKIP if the API key is not available or the execution target is unavailable.
 *
 * Run with: bun test test/integration/elevenlabs.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { IntegrationTestHarness } from "./runner";
import type { ExecutionTarget } from "@bands/format";
import { join } from "path";
import { rm } from "fs/promises";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

// Track skipped targets
const skippedTargets = new Set<string>();

/**
 * Check if ELEVENLABS_API_KEY is available.
 */
function hasApiKey(): boolean {
  return !!(process.env.ELEVENLABS_API_KEY);
}

/**
 * Run the ElevenLabs integration test suite for a given execution target.
 */
export function runElevenLabsSuite(
  target: ExecutionTarget,
  options: { timeout?: number; skipIfUnavailable?: boolean } = {}
) {
  const { timeout = 60000, skipIfUnavailable = true } = options;

  describe(`${target} ElevenLabs API Integration`, () => {
    const skipIf = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  ⏭  Skipping: ${msg}`);
        return true;
      }
      return false;
    };

    describe("API Connectivity", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-connectivity`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) {
          console.log("  ⏭  ELEVENLABS_API_KEY not set, skipping ElevenLabs integration tests");
          skippedTargets.add(`${target} (no API key)`);
          return;
        }

        available = await harness.checkAvailability();
        if (!available && !skipIfUnavailable) {
          throw new Error(`${target} executor is not available`);
        }
        if (!available) {
          skippedTargets.add(target);
        }
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
          // Clean up generated audio files
          try {
            await rm("/tmp/elevenlabs-test", { recursive: true, force: true });
          } catch {}
        }
      });

      test("validates API key by listing voices", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testNet: "api.elevenlabs.io",
          command: `curl -s -o /dev/null -w "%{http_code}" -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices`,
        });

        expect(result.success).toBe(true);
      }, timeout);

      test("rejects requests to non-allowed domains", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testNet: "evil.com",
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.net?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("Voice Listing (Read-Only)", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-voices`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("lists available voices", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices`,
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        // The response should contain voices array
        if (data.output) {
          const parsed = JSON.parse(data.output);
          expect(parsed.voices).toBeDefined();
          expect(Array.isArray(parsed.voices)).toBe(true);
          expect(parsed.voices.length).toBeGreaterThan(0);
        }
      }, timeout);

      test("gets default voice settings", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices/settings/default`,
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          const parsed = JSON.parse(data.output);
          expect(parsed.stability).toBeDefined();
          expect(parsed.similarity_boost).toBeDefined();
        }
      }, timeout);

      test("gets voice details for a specific voice", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        // First, list voices to get a valid voice ID
        const listResult = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices`,
          expectAllowed: true,
        });

        expect(listResult.success).toBe(true);
        const listData = listResult.data as any;
        let voiceId: string | undefined;

        if (listData.output) {
          const parsed = JSON.parse(listData.output);
          if (parsed.voices?.length > 0) {
            voiceId = parsed.voices[0].voice_id;
          }
        }

        if (!voiceId) {
          console.log("  ⏭  No voices found, skipping voice detail test");
          return;
        }

        const detailResult = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices/${voiceId}`,
          expectAllowed: true,
        });

        expect(detailResult.success).toBe(true);
        const detailData = detailResult.data as any;
        if (detailData.output) {
          const parsed = JSON.parse(detailData.output);
          expect(parsed.voice_id).toBe(voiceId);
          expect(parsed.name).toBeDefined();
        }
      }, timeout);
    });

    describe("Model Listing (Read-Only)", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-models`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("lists available models", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/models`,
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          const parsed = JSON.parse(data.output);
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed.length).toBeGreaterThan(0);
          // Should include the multilingual v2 model
          const modelIds = parsed.map((m: any) => m.model_id);
          expect(modelIds).toContain("eleven_multilingual_v2");
        }
      }, timeout);
    });

    describe("Subscription and Usage (Read-Only)", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-subscription`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("gets user subscription info", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/user/subscription`,
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          const parsed = JSON.parse(data.output);
          expect(parsed.character_count).toBeDefined();
          expect(parsed.character_limit).toBeDefined();
          expect(typeof parsed.character_count).toBe("number");
          expect(typeof parsed.character_limit).toBe("number");
        }
      }, timeout);

      test("gets user info", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/user`,
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          const parsed = JSON.parse(data.output);
          expect(parsed.subscription).toBeDefined();
        }
      }, timeout);
    });

    describe("Text-to-Speech Generation", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-tts`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout: timeout * 2, // TTS can be slower
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
          try {
            await rm("/tmp/elevenlabs-tts-test.mp3", { force: true });
          } catch {}
        }
      });

      test("generates speech from text", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        // First get a valid voice ID
        const listResult = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices`,
        });

        expect(listResult.success).toBe(true);
        const listData = listResult.data as any;
        let voiceId: string | undefined;

        if (listData.output) {
          const parsed = JSON.parse(listData.output);
          if (parsed.voices?.length > 0) {
            voiceId = parsed.voices[0].voice_id;
          }
        }

        if (!voiceId) {
          console.log("  ⏭  No voices available, skipping TTS test");
          return;
        }

        // Generate speech
        const ttsResult = await harness.execute({
          command: `curl -s -o /tmp/elevenlabs-tts-test.mp3 -w "%{http_code}" -X POST "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d '{"text":"Hello, this is an integration test.","model_id":"eleven_multilingual_v2"}'`,
        });

        expect(ttsResult.success).toBe(true);
        const ttsData = ttsResult.data as any;
        // HTTP 200 indicates success
        if (ttsData.output) {
          expect(ttsData.output.trim()).toBe("200");
        }

        // Verify output file exists and has content
        const verifyResult = await harness.execute({
          command: `ls -la /tmp/elevenlabs-tts-test.mp3 && file /tmp/elevenlabs-tts-test.mp3`,
        });

        expect(verifyResult.success).toBe(true);
      }, timeout * 2);
    });

    describe("Sound Effect Generation", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-sfx`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout: timeout * 2,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
          try {
            await rm("/tmp/elevenlabs-sfx-test.mp3", { force: true });
          } catch {}
        }
      });

      test("generates a sound effect from text description", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -o /tmp/elevenlabs-sfx-test.mp3 -w "%{http_code}" -X POST "https://api.elevenlabs.io/v1/sound-generation" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d '{"text":"gentle rain on a window","duration_seconds":2.0}'`,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          expect(data.output.trim()).toBe("200");
        }

        // Verify output
        const verifyResult = await harness.execute({
          command: `ls -la /tmp/elevenlabs-sfx-test.mp3 && file /tmp/elevenlabs-sfx-test.mp3`,
        });

        expect(verifyResult.success).toBe(true);
      }, timeout * 2);
    });

    describe("History (Read-Only)", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-history`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("lists generation history", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/history?page_size=5"`,
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          const parsed = JSON.parse(data.output);
          expect(parsed.history).toBeDefined();
          expect(Array.isArray(parsed.history)).toBe(true);
        }
      }, timeout);
    });

    describe("Permission Enforcement", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-permissions`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("allows network access to api.elevenlabs.io", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testNet: "api.elevenlabs.io",
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.net?.allowed).toBe(true);
      }, timeout);

      test("denies network access to unauthorized domains", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testNet: "api.openai.com",
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.net?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("allows CLI curl commands", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testCli: "curl -s https://api.elevenlabs.io/v1/voices",
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("allows writing to /tmp", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testWrite: "/tmp/elevenlabs-test-output.mp3",
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.write?.allowed).toBe(true);
      }, timeout);

      test("denies writing to /etc", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          testWrite: "/etc/malicious",
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.write?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("Error Handling", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-elevenlabs-errors`,
        bandPath: join(FIXTURES_DIR, "elevenlabs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        if (!hasApiKey()) return;

        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("returns 401 with invalid API key", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -o /dev/null -w "%{http_code}" -H "xi-api-key: invalid-key-12345" https://api.elevenlabs.io/v1/voices`,
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        if (data.output) {
          expect(data.output.trim()).toBe("401");
        }
      }, timeout);

      test("returns 422 with invalid TTS parameters", async () => {
        if (skipIf(!available || !hasApiKey(), `${target} not available or no API key`)) return;

        const result = await harness.execute({
          command: `curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.elevenlabs.io/v1/text-to-speech/invalid-voice-id" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d '{"text":"test"}'`,
        });

        expect(result.success).toBe(true);
        // Invalid voice ID should return a 4xx error
        const data = result.data as any;
        if (data.output) {
          const code = parseInt(data.output.trim());
          expect(code).toBeGreaterThanOrEqual(400);
          expect(code).toBeLessThan(500);
        }
      }, timeout);
    });
  });
}

/**
 * Print summary of skipped targets.
 */
export function printElevenLabsSkippedSummary() {
  if (skippedTargets.size > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("                  SKIPPED ELEVENLABS INTEGRATION TESTS");
    console.log("=".repeat(80));
    console.log("\nThe following were not available:\n");
    for (const target of skippedTargets) {
      console.log(`  • ${target}`);
    }
    console.log("\nSet ELEVENLABS_API_KEY in your environment or .env file to run these tests.");
    console.log("\n" + "=".repeat(80) + "\n");
  }
}

// Run across all available executors
runElevenLabsSuite("local-dangerously", {
  timeout: 30000,
  skipIfUnavailable: false,
});

runElevenLabsSuite("lima", {
  timeout: 180000,
  skipIfUnavailable: true,
});

runElevenLabsSuite("cloudflare", {
  timeout: 180000,
  skipIfUnavailable: true,
});

afterAll(() => {
  printElevenLabsSkippedSummary();
});
