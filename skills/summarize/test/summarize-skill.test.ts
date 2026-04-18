/**
 * Summarize Skill — Direct integration tests
 *
 * Requires ANTHROPIC_API_KEY to be set.
 * These tests make real API calls to Anthropic via Claude Code CLI.
 */

import { describe, expect, test } from "bun:test";
import { summarize, requireAnthropicEnv, TIMEOUT } from "./summarize-helpers";

describe("summarize skill: direct execution", () => {
  test(
    "summarizes a simple document",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document:
          "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet and has been used as a typing exercise since at least the late 19th century. It was first used by telegraph operators to test their equipment, and later adopted by typewriter manufacturers.",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(typeof data.summary).toBe("string");
      expect(data.summary.length).toBeGreaterThan(10);
      expect(data.summary.length).toBeLessThan(1000);
    },
    TIMEOUT
  );

  test(
    "respects guidance parameter",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({
        document:
          "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing algorithms that can access data and use it to learn for themselves. The process begins with observations or data, such as examples, direct experience, or instruction, to look for patterns in data and make better decisions in the future.",
        guidance: "One sentence only",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(typeof data.summary).toBe("string");
      expect(data.summary.length).toBeGreaterThan(10);
      // One sentence should be relatively short
      expect(data.summary.length).toBeLessThan(500);
    },
    TIMEOUT
  );

  test(
    "handles long documents",
    async () => {
      requireAnthropicEnv();
      // Generate a longer document
      const paragraph =
        "Software engineering is the systematic application of engineering approaches to the development of software. It encompasses a range of methodologies, tools, and practices aimed at producing high-quality software efficiently. ";
      const document = paragraph.repeat(10);

      const result = await summarize({
        document,
        guidance: "3 bullet points",
      });
      if (!result.success) throw new Error(`summarize failed: ${result.error}`);
      const data = result.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(data.summary.length).toBeGreaterThan(10);
    },
    TIMEOUT
  );

  test(
    "returns error for empty document",
    async () => {
      requireAnthropicEnv();
      const result = await summarize({ document: "" });
      // Should fail — empty document
      expect(result.success).toBe(false);
    },
    TIMEOUT
  );
});
