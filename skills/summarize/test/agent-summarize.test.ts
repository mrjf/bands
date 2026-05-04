/**
 * Summarize Agent Integration Tests (end-to-end via CLI)
 *
 * Runs Claude Code CLI in non-interactive mode with the summarize skill
 * and verifies it actually calls ./scripts/summarize and the script succeeds.
 *
 * Requires ANTHROPIC_API_KEY and a running Lima VM.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import {
  createSkillHarness,
  requireClaude,
  requireLima,
  expectScriptSucceeded,
} from "../../../scripts/cli-agent-test-helpers";

const { agentCall } = createSkillHarness(resolve(__dirname, ".."), {
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
});

const SUMMARIZE_TIMEOUT = 300_000;

describe("agent: summarize (end-to-end via CLI)", () => {
  beforeAll(() => {
    requireClaude();
    requireLima();
  });

  test(
    "claude calls ./scripts/summarize for a summarization request",
    async () => {
      const result = await agentCall(
        'Summarize this text: "The Internet of Things refers to the network of physical objects embedded with sensors, software, and connectivity that enables them to collect and exchange data. IoT has applications in smart homes, healthcare, agriculture, and industrial monitoring."'
      );

      expectScriptSucceeded(result, "summarize");
    },
    SUMMARIZE_TIMEOUT
  );

  test(
    "claude passes guidance through to the script",
    async () => {
      const result = await agentCall(
        'Summarize this in bullet points: "React is a JavaScript library for building user interfaces. It uses a component-based architecture where UIs are built from reusable pieces. React uses a virtual DOM for efficient rendering updates. It was created by Facebook and is now maintained by Meta and a community of developers."'
      );

      expectScriptSucceeded(result, "summarize");
    },
    SUMMARIZE_TIMEOUT
  );
});
