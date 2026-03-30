import { describe, test, expect, afterAll } from "bun:test";
import {
  agentCall,
  AGENT_TIMEOUT,
  GITHUB_REPO,
  gh,
} from "./agent-helpers";

describe("agent: labels", () => {
  const labelName = `agent-test-${Date.now()}`;
  const labelColor = "ff0000";

  afterAll(async () => {
    try {
      await gh("label-delete", { repo: GITHUB_REPO!, name: labelName });
    } catch {}
  }, AGENT_TIMEOUT);

  test(
    "label-create",
    async () => {
      const result = await agentCall(
        `Create a label named '${labelName}' with color ${labelColor} in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("label-create");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.name).toBe(labelName);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.created).toBe(true);
      expect(data.name).toBe(labelName);

      // Verify via API that the label exists
      const verify = await gh("label-list", { repo: GITHUB_REPO! });
      expect(verify.success).toBe(true);
      const labels = verify.data as any[];
      const found = labels.find((l: any) => l.name === labelName);
      expect(found).toBeTruthy();
      expect(found.color).toBe(labelColor);
    },
    AGENT_TIMEOUT
  );

  test(
    "label-list",
    async () => {
      const result = await agentCall(
        `List labels in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("label-list");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our label should be present
      const found = data.find((l: any) => l.name === labelName);
      expect(found).toBeTruthy();
      expect(found.color).toBe(labelColor);

      // Every item should have expected shape
      for (const item of data) {
        expect(typeof item.name).toBe("string");
        expect(typeof item.color).toBe("string");
      }
    },
    AGENT_TIMEOUT
  );

  test(
    "label-delete",
    async () => {
      const result = await agentCall(
        `Delete the label '${labelName}' from ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("label-delete");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.name).toBe(labelName);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.deleted).toBe(true);
      expect(data.name).toBe(labelName);

      // Verify the label is actually gone
      const verify = await gh("label-list", { repo: GITHUB_REPO! });
      expect(verify.success).toBe(true);
      const labels = verify.data as any[];
      const found = labels.find((l: any) => l.name === labelName);
      expect(found).toBeUndefined();
    },
    AGENT_TIMEOUT
  );
});
