/**
 * Summarize Agent Tests
 *
 * Tests that Claude correctly selects and uses the summarize script.
 * Requires ANTHROPIC_API_KEY.
 */

import { describe, test, expect } from "bun:test";
import { agentCall, AGENT_TIMEOUT } from "./agent-helpers";

describe("agent: summarize", () => {
  test(
    "summarize tool is selected for summarization requests",
    async () => {
      const result = await agentCall(
        'Summarize this text: "The Internet of Things refers to the network of physical objects embedded with sensors, software, and connectivity that enables them to collect and exchange data. IoT has applications in smart homes, healthcare, agriculture, and industrial monitoring."'
      );

      expect(result.toolName).toBe("summarize");
      expect(result.execResult.success).toBe(true);
      const data = result.execResult.data as { summary: string };
      expect(data.summary).toBeDefined();
      expect(typeof data.summary).toBe("string");
      expect(data.summary.length).toBeGreaterThan(10);
    },
    AGENT_TIMEOUT
  );

  test(
    "summarize with guidance",
    async () => {
      const result = await agentCall(
        'Summarize this in bullet points: "React is a JavaScript library for building user interfaces. It uses a component-based architecture where UIs are built from reusable pieces. React uses a virtual DOM for efficient rendering updates. It was created by Facebook and is now maintained by Meta and a community of developers."'
      );

      expect(result.toolName).toBe("summarize");
      expect(result.execResult.success).toBe(true);
      const data = result.execResult.data as { summary: string };
      expect(data.summary).toBeDefined();
    },
    AGENT_TIMEOUT
  );
});
