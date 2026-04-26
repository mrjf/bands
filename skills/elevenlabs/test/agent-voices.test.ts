/**
 * ElevenLabs Agent Tests — Voice operations (end-to-end via CLI)
 *
 * Tests that Claude correctly selects and uses ElevenLabs voice scripts
 * by running the real Claude Code CLI.
 *
 * Requires TEST_ELEVEN_LABS_TOKEN and ANTHROPIC_API_KEY.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import {
  createSkillHarness,
  requireLima,
  expectScriptSucceeded,
  AGENT_TIMEOUT,
} from "../../../scripts/cli-agent-test-helpers";

const { agentCall, exec: el } = createSkillHarness(resolve(__dirname, ".."), {
  ELEVENLABS_API_KEY: "TEST_ELEVEN_LABS_TOKEN",
});

describe("agent: elevenlabs voices", () => {
  beforeAll(() => {
    requireLima();
  });

  let voiceId: string;

  test(
    "voice-list",
    async () => {
      const result = await agentCall("List the available ElevenLabs voices");
      expectScriptSucceeded(result, "voice-list");

      // Get a voice ID for subsequent tests
      const direct = await el("voice-list", {});
      expect(direct.success).toBe(true);
      const voices = direct.data as any[];
      expect(voices.length).toBeGreaterThan(0);
      voiceId = voices[0].voice_id;
    },
    AGENT_TIMEOUT
  );

  test(
    "voice-get",
    async () => {
      if (!voiceId) {
        const direct = await el("voice-list", {});
        voiceId = (direct.data as any[])[0].voice_id;
      }

      const result = await agentCall(
        `Get the details for ElevenLabs voice ${voiceId}`
      );
      expectScriptSucceeded(result, "voice-get");
    },
    AGENT_TIMEOUT
  );

  test(
    "user-info",
    async () => {
      const result = await agentCall(
        "Get my ElevenLabs account info and subscription details"
      );
      expectScriptSucceeded(result, "user-info");
    },
    AGENT_TIMEOUT
  );

  test(
    "tts",
    async () => {
      if (!voiceId) {
        const direct = await el("voice-list", {});
        voiceId = (direct.data as any[])[0].voice_id;
      }

      const result = await agentCall(
        `Generate speech saying "Hi" using ElevenLabs voice ${voiceId}, save to /tmp/agent-tts-test.mp3`
      );
      expectScriptSucceeded(result, "tts");
    },
    AGENT_TIMEOUT
  );
});
