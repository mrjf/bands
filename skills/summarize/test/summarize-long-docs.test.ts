/**
 * Summarize Skill — Long document integration tests (end-to-end via CLI)
 *
 * Runs Claude Code CLI in non-interactive mode, asks it to fetch a real
 * web document and summarize it using the banded skill.
 *
 * Verifies that Claude actually calls ./scripts/summarize and the script
 * succeeds inside the Lima VM.
 *
 * Requires ANTHROPIC_API_KEY and a running Lima VM.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import {
  createSkillHarness,
  requireLima,
  expectScriptSucceeded,
} from "../../../scripts/cli-agent-test-helpers";

const { agentCall } = createSkillHarness(resolve(__dirname, ".."), {
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
});

const TIMEOUT = 300_000;

describe("summarize skill: long documents (end-to-end via CLI)", () => {
  beforeAll(() => {
    requireLima();
  });

  test(
    "fetches and summarizes RFC 9293 (TCP) from IETF",
    async () => {
      const result = await agentCall(
        'Fetch and summarize this document: https://www.rfc-editor.org/rfc/rfc9293.txt -- give me a 3-5 sentence overview of what TCP does.'
      );

      expectScriptSucceeded(result, "summarize");
    },
    TIMEOUT
  );

  test(
    "fetches and summarizes a Project Gutenberg text with guidance",
    async () => {
      const result = await agentCall(
        'Fetch https://www.gutenberg.org/cache/epub/11/pg11.txt and summarize the first few chapters. Use bullet points, one per chapter.'
      );

      expectScriptSucceeded(result, "summarize");
    },
    TIMEOUT
  );
});
