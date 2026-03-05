/**
 * Integration tests for the ElevenLabs skill band.
 *
 * Tests band parsing, server initialization, and request acceptance
 * for text-to-speech, voice management, voice cloning, sound effects,
 * speech-to-speech, and audio isolation operations.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("ElevenLabs Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("elevenlabs"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("elevenlabs");
    });
  });

  describe("Text-to-Speech", () => {
    it("should accept a basic text-to-speech request", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "Hello, this is a test of the ElevenLabs API.",
        output: "/tmp/output.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request with model selection", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "Testing with multilingual model.",
        modelId: "eleven_multilingual_v2",
        output: "/tmp/multilingual.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request with custom voice settings", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "Testing with custom voice settings.",
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.9,
        },
        output: "/tmp/custom_settings.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request with low-latency model", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "Low latency generation.",
        modelId: "eleven_turbo_v2_5",
        output: "/tmp/turbo.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request with a specific output format", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "PCM output format.",
        outputFormat: "pcm_44100",
        output: "/tmp/output.pcm",
      });
      assertSuccess(response);
    });

    it("should accept a streaming text-to-speech request", async () => {
      const response = await harness.request({
        task: "text_to_speech_stream",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "This is streamed audio content.",
        modelId: "eleven_multilingual_v2",
        output: "/tmp/streamed.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a long-form text-to-speech request", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "This is a much longer passage of text that would be used to test the synthesis of extended content. It contains multiple sentences and should generate a longer audio file than the basic test cases.",
        modelId: "eleven_multilingual_v2",
        output: "/tmp/long_form.mp3",
      });
      assertSuccess(response);
    });
  });

  describe("Voice Management", () => {
    it("should accept a request to list all voices", async () => {
      const response = await harness.request({
        task: "list_voices",
      });
      assertSuccess(response);
    });

    it("should accept a request to get voice details", async () => {
      const response = await harness.request({
        task: "get_voice",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      });
      assertSuccess(response);
    });

    it("should accept a request to get default voice settings", async () => {
      const response = await harness.request({
        task: "get_default_voice_settings",
      });
      assertSuccess(response);
    });

    it("should accept a request to edit voice settings", async () => {
      const response = await harness.request({
        task: "edit_voice_settings",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        settings: {
          stability: 0.6,
          similarity_boost: 0.8,
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to search voices by name", async () => {
      const response = await harness.request({
        task: "search_voices",
        query: "Rachel",
      });
      assertSuccess(response);
    });
  });

  describe("Voice Cloning", () => {
    it("should accept a request to clone a voice from a single sample", async () => {
      const response = await harness.request({
        task: "clone_voice",
        name: "My Cloned Voice",
        description: "A cloned voice from a sample recording",
        files: ["/path/to/sample1.mp3"],
      });
      assertSuccess(response);
    });

    it("should accept a request to clone a voice from multiple samples", async () => {
      const response = await harness.request({
        task: "clone_voice",
        name: "Multi-Sample Clone",
        description: "Cloned from three audio samples",
        files: [
          "/path/to/sample1.mp3",
          "/path/to/sample2.wav",
          "/path/to/sample3.m4a",
        ],
      });
      assertSuccess(response);
    });

    it("should accept a request to clone with labels", async () => {
      const response = await harness.request({
        task: "clone_voice",
        name: "Labeled Clone",
        description: "Clone with metadata labels",
        files: ["/path/to/sample.mp3"],
        labels: {
          accent: "american",
          gender: "female",
          age: "young",
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to delete a cloned voice", async () => {
      const response = await harness.request({
        task: "delete_voice",
        voiceId: "custom-voice-id-123",
      });
      assertSuccess(response);
    });
  });

  describe("Sound Effect Generation", () => {
    it("should accept a basic sound effect request", async () => {
      const response = await harness.request({
        task: "generate_sound_effect",
        text: "Gentle rain falling on a tin roof",
        output: "/tmp/rain.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a sound effect request with duration", async () => {
      const response = await harness.request({
        task: "generate_sound_effect",
        text: "Thunder clap followed by rolling thunder",
        durationSeconds: 10.0,
        output: "/tmp/thunder.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a short sound effect request", async () => {
      const response = await harness.request({
        task: "generate_sound_effect",
        text: "Quick button click",
        durationSeconds: 0.5,
        output: "/tmp/click.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a complex ambient sound request", async () => {
      const response = await harness.request({
        task: "generate_sound_effect",
        text: "Busy coffee shop with muffled conversations, espresso machine hissing, and cups clinking",
        durationSeconds: 15.0,
        output: "/tmp/coffee_shop.mp3",
      });
      assertSuccess(response);
    });
  });

  describe("Speech-to-Speech", () => {
    it("should accept a basic speech-to-speech request", async () => {
      const response = await harness.request({
        task: "speech_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        audioFile: "/path/to/input_speech.mp3",
        output: "/tmp/transformed.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a speech-to-speech request with model selection", async () => {
      const response = await harness.request({
        task: "speech_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        audioFile: "/path/to/input_speech.wav",
        modelId: "eleven_english_sts_v2",
        output: "/tmp/transformed_v2.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a speech-to-speech request with voice settings", async () => {
      const response = await harness.request({
        task: "speech_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        audioFile: "/path/to/input.mp3",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.85,
        },
        output: "/tmp/custom_sts.mp3",
      });
      assertSuccess(response);
    });
  });

  describe("Audio Isolation", () => {
    it("should accept a basic audio isolation request", async () => {
      const response = await harness.request({
        task: "audio_isolation",
        audioFile: "/path/to/noisy_audio.mp3",
        output: "/tmp/clean_audio.mp3",
      });
      assertSuccess(response);
    });

    it("should accept audio isolation with different input formats", async () => {
      const response = await harness.request({
        task: "audio_isolation",
        audioFile: "/path/to/noisy_recording.wav",
        output: "/tmp/clean_recording.wav",
      });
      assertSuccess(response);
    });
  });

  describe("User and Subscription", () => {
    it("should accept a request to get user info", async () => {
      const response = await harness.request({
        task: "get_user_info",
      });
      assertSuccess(response);
    });

    it("should accept a request to get subscription status", async () => {
      const response = await harness.request({
        task: "get_subscription",
      });
      assertSuccess(response);
    });

    it("should accept a request to check character usage", async () => {
      const response = await harness.request({
        task: "check_usage",
      });
      assertSuccess(response);
    });
  });

  describe("Models", () => {
    it("should accept a request to list available models", async () => {
      const response = await harness.request({
        task: "list_models",
      });
      assertSuccess(response);
    });
  });

  describe("History", () => {
    it("should accept a request to list generation history", async () => {
      const response = await harness.request({
        task: "get_history",
      });
      assertSuccess(response);
    });

    it("should accept a request to get a specific history item", async () => {
      const response = await harness.request({
        task: "get_history_item",
        historyItemId: "abc123",
      });
      assertSuccess(response);
    });

    it("should accept a request to download history audio", async () => {
      const response = await harness.request({
        task: "download_history_item",
        historyItemId: "abc123",
        output: "/tmp/history_audio.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request to delete a history item", async () => {
      const response = await harness.request({
        task: "delete_history_item",
        historyItemId: "abc123",
      });
      assertSuccess(response);
    });
  });

  describe("Batch Operations", () => {
    it("should accept a batch text-to-speech request", async () => {
      const response = await harness.request({
        task: "batch_text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        items: [
          { text: "First sentence.", output: "/tmp/batch_1.mp3" },
          { text: "Second sentence.", output: "/tmp/batch_2.mp3" },
          { text: "Third sentence.", output: "/tmp/batch_3.mp3" },
        ],
        modelId: "eleven_multilingual_v2",
      });
      assertSuccess(response);
    });

    it("should accept a batch request with different voices", async () => {
      const response = await harness.request({
        task: "batch_text_to_speech",
        items: [
          { text: "Hello from voice one.", voiceId: "voice-1", output: "/tmp/v1.mp3" },
          { text: "Hello from voice two.", voiceId: "voice-2", output: "/tmp/v2.mp3" },
        ],
      });
      assertSuccess(response);
    });
  });

  describe("Edge Cases", () => {
    it("should accept a request with minimal TTS parameters", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        text: "Minimal parameters.",
        output: "/tmp/minimal.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request with all TTS parameters specified", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "Full parameters.",
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        output: "/tmp/full_params.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request with very long text", async () => {
      const response = await harness.request({
        task: "text_to_speech",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        text: "A".repeat(5000),
        output: "/tmp/long_text.mp3",
      });
      assertSuccess(response);
    });
  });

  describe("Output Verification", () => {
    it("should accept a request to verify generated audio", async () => {
      const response = await harness.request({
        task: "verify_output",
        file: "/tmp/output.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request to get audio metadata", async () => {
      const response = await harness.request({
        task: "get_audio_metadata",
        file: "/tmp/output.mp3",
      });
      assertSuccess(response);
    });

    it("should accept a request to concatenate audio files", async () => {
      const response = await harness.request({
        task: "concatenate_audio",
        files: ["/tmp/batch_1.mp3", "/tmp/batch_2.mp3", "/tmp/batch_3.mp3"],
        output: "/tmp/concatenated.mp3",
      });
      assertSuccess(response);
    });
  });
});
