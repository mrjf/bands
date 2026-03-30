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
  }, AGENT_TIMEOUT);

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

      // Verify the gist actually exists and has correct content
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(true);
      const gist = verify.data as any;
      expect(gist.id).toBe(gistId);
      expect(gist.public).toBe(false);
      expect(gist.files).toBeInstanceOf(Array);
      expect(gist.files.length).toBe(1);
      expect(gist.files[0].filename).toBe("test.ts");
      expect(gist.files[0].language).toBe("TypeScript");
      expect(gist.files[0].size).toBeGreaterThan(0);

      // Fetch raw content via API to verify file contents
      const raw = await gh("api", { endpoint: `gists/${gistId}`, method: "GET" });
      expect(raw.success).toBe(true);
      const rawData = raw.data as any;
      const fileContent = rawData.files["test.ts"].content;
      expect(fileContent.trim()).toBe(gistContent);
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

      // Our gist should be in the list with correct metadata
      const found = data.find((g: any) => g.id === gistId);
      expect(found).toBeTruthy();
      expect(found.url).toContain("gist.github.com");
      expect(found.public).toBe(false);
      expect(found.files).toBeInstanceOf(Array);
      expect(found.files.length).toBe(1);
      expect(found.files[0]).toContain("test.ts");

      // Every item should have expected shape
      for (const item of data) {
        expect(typeof item.id).toBe("string");
        expect(item.id.length).toBeGreaterThan(0);
        expect(typeof item.public).toBe("boolean");
        expect(item.url).toContain("gist.github.com");
        expect(item.files).toBeInstanceOf(Array);
        expect(item.files.length).toBeGreaterThan(0);
        expect(typeof item.updatedAt).toBe("string");
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
      expect(data.files).toBeInstanceOf(Array);
      expect(data.files.length).toBe(1);
      expect(data.files[0].filename).toBe("test.ts");
      expect(data.files[0].language).toBe("TypeScript");
      expect(data.files[0].size).toBeGreaterThan(0);
      expect(data.owner).toBeTruthy();
      expect(typeof data.owner.login).toBe("string");
      expect(data.owner.login.length).toBeGreaterThan(0);
      expect(data.createdAt).toBeTruthy();
      expect(data.updatedAt).toBeTruthy();
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
