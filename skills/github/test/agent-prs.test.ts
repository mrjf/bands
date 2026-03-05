import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  agentCall,
  AGENT_TIMEOUT,
  GITHUB_REPO,
  gh,
  ensureRepoInitialized,
  createBranchWithFile,
} from "./agent-helpers";

const SETUP_TIMEOUT = AGENT_TIMEOUT * 3;

describe("agent: pull requests", () => {
  let repoInitialized = false;
  const lifecycleBranch = `agent-pr-${Date.now()}`;
  const mergeBranch = `agent-pr-merge-${Date.now()}`;
  let prNumber: number;
  let mergePrNumber: number;

  beforeAll(async () => {
    repoInitialized = await ensureRepoInitialized();
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    if (prNumber) {
      try {
        await gh("pr-close", { repo: GITHUB_REPO!, number: prNumber, delete_branch: true });
      } catch {}
    }
  });

  test(
    "setup: create branches",
    async () => {
      expect(repoInitialized).toBe(true);
      await createBranchWithFile(lifecycleBranch);
      await createBranchWithFile(mergeBranch);
    },
    SETUP_TIMEOUT
  );

  test(
    "pr-create",
    async () => {
      const prTitle = `Agent PR ${lifecycleBranch}`;
      const result = await agentCall(
        `Create a pull request titled '${prTitle}' from branch ${lifecycleBranch} to main in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("pr-create");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.head).toBe(lifecycleBranch);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      prNumber = data.number;
      expect(prNumber).toBeGreaterThan(0);
      expect(data.url).toContain("github.com");
      expect(data.title).toBe(prTitle);

      // Verify via API that the PR actually exists with correct state
      const verify = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
      expect(verify.success).toBe(true);
      const pr = verify.data as any;
      expect(pr.title).toBe(prTitle);
      expect(pr.state).toMatch(/OPEN|open/i);
      expect(pr.headRefName).toBe(lifecycleBranch);
      expect(pr.baseRefName).toBe("main");
      expect(pr.isDraft).toBe(false);
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-view",
    async () => {
      expect(prNumber, "pr-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `View pull request #${prNumber} in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("pr-view");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(prNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.number).toBe(prNumber);
      expect(data.state).toMatch(/OPEN|open/i);
      expect(data.headRefName).toBe(lifecycleBranch);
      expect(data.baseRefName).toBe("main");
      expect(data.author.login).toBeTruthy();
      expect(data.url).toContain(`${prNumber}`);
      expect(data.createdAt).toBeTruthy();
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-list",
    async () => {
      expect(prNumber, "pr-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `List open pull requests in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("pr-list");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our PR should be in the list
      const found = data.find((p: any) => p.number === prNumber);
      expect(found).toBeTruthy();
      expect(found.headRefName).toBe(lifecycleBranch);
      expect(found.state).toMatch(/OPEN|open/i);

      // Every item should have expected shape
      for (const item of data) {
        expect(item.number).toBeGreaterThan(0);
        expect(typeof item.title).toBe("string");
        expect(item.url).toContain("github.com");
      }
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-diff",
    async () => {
      expect(prNumber, "pr-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `Show the diff for pull request #${prNumber} in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("pr-diff");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(prNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      // Diff output should contain the file we created in the branch
      const diff = typeof data === "string" ? data : data.diff;
      expect(typeof diff).toBe("string");
      expect(diff.length).toBeGreaterThan(0);
      expect(diff).toContain("diff");
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-checks",
    async () => {
      expect(prNumber, "pr-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `Show CI checks for pull request #${prNumber} in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("pr-checks");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(prNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data;
      // Checks is an array (may be empty if no CI configured)
      expect(Array.isArray(data)).toBe(true);
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-review",
    async () => {
      expect(prNumber, "pr-create must succeed first").toBeGreaterThan(0);
      const reviewBody = "Agent test review comment";
      const result = await agentCall(
        `Leave a COMMENT review (not approve) on pull request #${prNumber} in ${GITHUB_REPO} with body '${reviewBody}'`
      );

      expect(result.toolName).toBe("pr-review");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(prNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.state).toBeTruthy();

      // Verify the review exists on the PR
      const verify = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
      expect(verify.success).toBe(true);
      const reviews = (verify.data as any).reviews;
      expect(Array.isArray(reviews)).toBe(true);
      expect(reviews.length).toBeGreaterThan(0);
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-close",
    async () => {
      expect(prNumber, "pr-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `Close pull request #${prNumber} in ${GITHUB_REPO} without merging`
      );

      expect(result.toolName).toBe("pr-close");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(prNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.closed).toBe(true);
      expect(data.number).toBe(prNumber);

      // Verify the PR is actually closed
      const verify = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
      expect(verify.success).toBe(true);
      expect((verify.data as any).state).toMatch(/CLOSED|closed/i);
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-merge",
    async () => {
      // Create a separate PR for merging
      const mergeTitle = `Agent merge PR ${mergeBranch}`;
      const createResult = await gh("pr-create", {
        repo: GITHUB_REPO!,
        title: mergeTitle,
        body: "Agent test PR for merge",
        head: mergeBranch,
        base: "main",
      });
      expect(createResult.success).toBe(true);
      mergePrNumber = (createResult.data as any).number;

      const result = await agentCall(
        `Merge pull request #${mergePrNumber} in ${GITHUB_REPO} using squash`
      );

      expect(result.toolName).toBe("pr-merge");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(mergePrNumber);
      expect(result.toolInput.method).toBe("squash");
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.merged).toBe(true);

      // Verify the PR is actually merged
      const verify = await gh("pr-view", { repo: GITHUB_REPO!, number: mergePrNumber });
      expect(verify.success).toBe(true);
      expect((verify.data as any).state).toMatch(/MERGED|merged/i);
    },
    AGENT_TIMEOUT * 2
  );
});
