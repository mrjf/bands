import { describe, test, expect } from "bun:test";
import {
  agentCall,
  AGENT_TIMEOUT,
  GITHUB_REPO,
  gh,
} from "./agent-helpers";

describe("agent: repo & CI", () => {
  test(
    "repo-view",
    async () => {
      const result = await agentCall(
        `View repository metadata for ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("repo-view");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      const [, repoName] = GITHUB_REPO!.split("/");
      expect(data.name).toBe(repoName);
      expect(data.url).toContain("github.com");
      expect(typeof data.stars).toBe("number");
      expect(typeof data.forks).toBe("number");
      expect(data.visibility).toBeTruthy();
      expect(data.defaultBranch).toBeTruthy();

      // Cross-check with direct API call
      const verify = await gh("repo-view", { repo: GITHUB_REPO! });
      expect(verify.success).toBe(true);
      expect((verify.data as any).name).toBe(data.name);
      expect((verify.data as any).stars).toBe(data.stars);
    },
    AGENT_TIMEOUT
  );

  test(
    "run-list",
    async () => {
      const result = await agentCall(
        `List workflow runs for ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("run-list");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
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
      const listResult = await gh("run-list", { repo: GITHUB_REPO! });
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

      expect(result.toolName).toBe("run-view");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.run_id).toBe(runId);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
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

      expect(result.toolName).toBe("search");
      expect(result.toolInput.query).toContain("bun");
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    },
    AGENT_TIMEOUT
  );

  test(
    "api",
    async () => {
      const result = await agentCall(
        `Get the authenticated user via the GitHub API`
      );

      expect(result.toolName).toBe("api");
      expect(result.toolInput.endpoint).toMatch(/^user$/);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.login).toBeTruthy();
      expect(typeof data.login).toBe("string");
      expect(data.id).toBeGreaterThan(0);

      // Cross-check: the login should match what the API returns directly
      const verify = await gh("api", { endpoint: "user" });
      expect(verify.success).toBe(true);
      expect((verify.data as any).login).toBe(data.login);
      expect((verify.data as any).id).toBe(data.id);
    },
    AGENT_TIMEOUT
  );
});
