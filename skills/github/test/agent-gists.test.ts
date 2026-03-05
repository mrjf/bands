import { describe, test, expect, afterAll } from "bun:test";
import {
  agentCall,
  AGENT_TIMEOUT,
  gh,
} from "./agent-gist-helpers";

describe("agent: gists", () => {
  let gistId: string;

  afterAll(async () => {
    if (gistId) {
      try {
        await gh("gist-delete", { id: gistId });
      } catch {}
    }
  });

  test(
    "gist-create",
    async () => {
      const gistContent = 'console.log("agent test")';
      const result = await agentCall(
        `Create a secret gist with filename 'test.ts' containing '${gistContent}'`
      );

      expect(result.toolName).toBe("gist-create");
      expect(result.toolInput.filename).toBe("test.ts");
      expect(result.toolInput.content).toContain("console.log");
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      gistId = data.id;
      expect(gistId).toBeTruthy();
      expect(data.url).toContain("gist.github.com");

      // Verify the gist actually exists
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(true);
      const gist = verify.data as any;
      expect(gist.id).toBe(gistId);
      expect(gist.public).toBe(false);
      expect(gist.files).toBeTruthy();
      expect(gist.files.length).toBeGreaterThan(0);
    },
    AGENT_TIMEOUT
  );

  test(
    "gist-list",
    async () => {
      expect(gistId, "gist-create must succeed first").toBeTruthy();
      const result = await agentCall(
        `List my gists`
      );

      expect(result.toolName).toBe("gist-list");
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our gist should be in the list
      const found = data.find((g: any) => g.id === gistId);
      expect(found).toBeTruthy();
      expect(found.url).toContain("gist.github.com");

      // Every item should have expected shape
      for (const item of data) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.public).toBe("boolean");
        expect(item.url).toContain("gist.github.com");
      }
    },
    AGENT_TIMEOUT
  );

  test(
    "gist-view",
    async () => {
      expect(gistId, "gist-create must succeed first").toBeTruthy();
      const result = await agentCall(
        `View gist ${gistId}`
      );

      expect(result.toolName).toBe("gist-view");
      expect(result.toolInput.id).toBe(gistId);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.id).toBe(gistId);
      expect(data.public).toBe(false);
      expect(data.files).toBeTruthy();
      expect(data.files.length).toBeGreaterThan(0);
      expect(data.owner).toBeTruthy();
      expect(data.owner.login).toBeTruthy();
      expect(data.createdAt).toBeTruthy();
      expect(data.url).toContain("gist.github.com");
    },
    AGENT_TIMEOUT
  );

  test(
    "gist-delete",
    async () => {
      expect(gistId, "gist-create must succeed first").toBeTruthy();
      const result = await agentCall(
        `Delete gist ${gistId}`
      );

      expect(result.toolName).toBe("gist-delete");
      expect(result.toolInput.id).toBe(gistId);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.deleted).toBe(true);
      expect(data.id).toBe(gistId);

      // Verify the gist is actually gone
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(false);

      gistId = ""; // Prevent afterAll cleanup attempt
    },
    AGENT_TIMEOUT
  );
});
