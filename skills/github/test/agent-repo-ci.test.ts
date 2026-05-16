import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import {
  createSkillHarness,
  requireClaude,
  requireLima,
  expectScriptSucceeded,
  AGENT_TIMEOUT,
} from "../../../scripts/cli-agent-test-helpers";

const GITHUB_REPO = process.env.TEST_GITHUB_REPO;
const { agentCall, exec: gh } = createSkillHarness(resolve(__dirname, ".."), {
  GITHUB_TOKEN: "TEST_GITHUB_TOKEN",
});

describe("agent: repo & CI", () => {
  beforeAll(() => {
    requireClaude();
    requireLima();
  });

  test(
    "repo-view",
    async () => {
      const result = await agentCall(
        `View repository metadata for ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "repo-view");

      // Verify via direct API call
      const verify = await gh("repo-view", { repo: GITHUB_REPO });
      expect(verify.success).toBe(true);
      const data = verify.data as any;
      const [, repoName] = GITHUB_REPO.split("/");
      expect(data.name).toBe(repoName);
      expect(data.url).toContain("github.com");
      expect(typeof data.stars).toBe("number");
      expect(typeof data.forks).toBe("number");
      expect(data.visibility).toBeTruthy();
      expect(data.defaultBranch).toBeTruthy();
    },
    AGENT_TIMEOUT
  );

  test(
    "run-list",
    async () => {
      const result = await agentCall(
        `List workflow runs for ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "run-list");

      // Verify via direct API
      const verify = await gh("run-list", { repo: GITHUB_REPO });
      expect(verify.success).toBe(true);
      const data = verify.data as any[];
      expect(Array.isArray(data)).toBe(true);

      // If there are runs, verify their shape
      if (data.length > 0) {
        for (const run of data) {
          expect(run.databaseId).toBeGreaterThan(0);
          expect(typeof run.name).toBe("string");
          expect(typeof run.status).toBe("string");
          expect(run.url).toContain("github.com");
        }
      }
    },
    AGENT_TIMEOUT
  );

  test(
    "run-view",
    async () => {
      // First get a run ID to view
      const listResult = await gh("run-list", { repo: GITHUB_REPO });
      expect(listResult.success).toBe(true);
      const runs = listResult.data as any[];
      expect(Array.isArray(runs)).toBe(true);

      // Skip if no workflow runs exist in the repo
      if (runs.length === 0) return;

      const targetRun = runs[0];
      const runId = String(targetRun.databaseId);

      const result = await agentCall(
        `View workflow run ${runId} in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "run-view");

      // Verify via direct API
      const verify = await gh("run-view", { repo: GITHUB_REPO, run_id: runId });
      expect(verify.success).toBe(true);
      const data = verify.data as any;
      expect(data.databaseId).toBe(targetRun.databaseId);
      expect(typeof data.name).toBe("string");
      expect(typeof data.status).toBe("string");
      expect(data.url).toContain("github.com");
      expect(data.headSha).toBeTruthy();
      expect(data.createdAt).toBeTruthy();
      expect(Array.isArray(data.jobs)).toBe(true);
    },
    AGENT_TIMEOUT
  );

  test(
    "search",
    async () => {
      const result = await agentCall(
        `Search GitHub for repositories about 'bun runtime'`
      );

      expectScriptSucceeded(result, "search");

      // Verify via direct API
      const verify = await gh("search", { query: "bun runtime" });
      expect(verify.success).toBe(true);
      const data = verify.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    },
    AGENT_TIMEOUT
  );

  test(
    "api",
    async () => {
      const result = await agentCall(
        `Use the api script to call the "user" endpoint to get the authenticated user`
      );

      expectScriptSucceeded(result, "api");

      // Verify via direct API call
      const verify = await gh("api", { endpoint: "user" });
      expect(verify.success, `api verify failed: ${verify.error}`).toBe(true);
      const data = verify.data as any;
      expect(data.login).toBeTruthy();
      expect(typeof data.login).toBe("string");
      expect(data.id).toBeGreaterThan(0);
    },
    AGENT_TIMEOUT
  );
});
