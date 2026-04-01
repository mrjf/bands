/**
 * ElevenLabs Agent Tests — Voice operations
 *
 * Tests that Claude correctly selects and uses ElevenLabs voice scripts.
 * Requires TEST_ELEVEN_LABS_TOKEN and ANTHROPIC_API_KEY.
 */

import { describe, test, expect } from "bun:test";
import { agentCall, AGENT_TIMEOUT } from "./agent-helpers";

describe("agent: elevenlabs voices", () => {
  let voiceId: string;

  test(
    "voice-list",
    async () => {
      const result = await agentCall("List the available ElevenLabs voices");

      expect(result.toolName).toBe("voice-list");
      expect(result.execResult.success).toBe(true);
      const data = result.execResult.data as any[];
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      voiceId = data[0].voice_id;
    },
    AGENT_TIMEOUT
  );

  test(
    "voice-get",
    async () => {
      if (!voiceId) {
        const listResult = await agentCall("List the available ElevenLabs voices");
        voiceId = (listResult.execResult.data as any[])[0].voice_id;
      }

      const result = await agentCall(
        `Get the details for ElevenLabs voice ${voiceId}`
      );

      expect(result.toolName).toBe("voice-get");
      expect(result.execResult.success).toBe(true);
      const data = result.execResult.data as any;
      expect(data.voice_id).toBe(voiceId);
      expect(data.name).toBeDefined();
    },
    AGENT_TIMEOUT
  );

  test(
    "user-info",
    async () => {
      const result = await agentCall(
        "Get my ElevenLabs account info and subscription details"
      );

      expect(result.toolName).toBe("user-info");
      expect(result.execResult.success).toBe(true);
      const data = result.execResult.data as any;
      expect(data.tier).toBeDefined();
    },
    AGENT_TIMEOUT
  );

  test(
    "tts",
    async () => {
      if (!voiceId) {
        const listResult = await agentCall("List the available ElevenLabs voices");
        voiceId = (listResult.execResult.data as any[])[0].voice_id;
      }

      const result = await agentCall(
        `Generate speech saying "Hi" using ElevenLabs voice ${voiceId}, save to /tmp/agent-tts-test.mp3`
      );

      expect(result.toolName).toBe("tts");
      expect(result.execResult.success).toBe(true);
      const data = result.execResult.data as any;
      expect(data.success).toBe(true);
    },
    AGENT_TIMEOUT
  );
});
