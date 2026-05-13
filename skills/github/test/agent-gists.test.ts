import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "path";
import {
  createSkillHarness,
  requireClaude,
  requireLima,
  expectScriptSucceeded,
  AGENT_TIMEOUT,
} from "../../../scripts/cli-agent-test-helpers";

const { agentCall, exec: gh } = createSkillHarness(resolve(__dirname, ".."), {
  GITHUB_TOKEN: "TEST_GIST_GITHUB_TOKEN",
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1500;

describe("agent: gists", () => {
  beforeAll(() => {
    requireClaude();
    requireLima();
  });

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

      expectScriptSucceeded(result, "gist-create");

      // Verify the gist was created by listing gists and finding it
      const listResult = await gh("gist-list", {});
      expect(listResult.success).toBe(true);
      const gists = listResult.data as any[];
      // Find the most recently created gist with test.ts
      const created = gists.find((g: any) =>
        g.files && Array.isArray(g.files) && g.files.some((f: string) => f.includes("test.ts"))
      );
      expect(created).toBeTruthy();
      gistId = created.id;
      expect(gistId).toBeTruthy();

      // Verify the gist content via direct API
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

      expectScriptSucceeded(result, "gist-list");

      // Verify via direct API
      const verify = await gh("gist-list", {});
      expect(verify.success).toBe(true);
      const data = verify.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our gist should be in the list with correct metadata (eventual consistency)
      let found = data.find((g: any) => g.id === gistId);
      for (let retryAttempt = 0; retryAttempt < MAX_RETRY_ATTEMPTS && !found; retryAttempt++) {
        const retryVerify = await gh("gist-list", {});
        expect(retryVerify.success).toBe(true);
        const retryData = retryVerify.data as any[];
        found = retryData.find((g: any) => g.id === gistId);
        if (!found && retryAttempt < MAX_RETRY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
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

      expectScriptSucceeded(result, "gist-view");

      // Verify via direct API
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(true);
      const data = verify.data as any;
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

      expectScriptSucceeded(result, "gist-delete");

      // Verify the gist is actually gone
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(false);

      gistId = ""; // Prevent afterAll cleanup attempt
    },
    AGENT_TIMEOUT
  );
});
