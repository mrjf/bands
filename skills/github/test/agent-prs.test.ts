import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "path";
import {
  createSkillHarness,
  requireClaude,
  requireLima,
  expectScriptSucceeded,
  AGENT_TIMEOUT,
} from "../../../scripts/cli-agent-test-helpers";
import { ensureRepoInitialized, createBranchWithFile } from "./github-helpers";

const GITHUB_REPO = process.env.TEST_GITHUB_REPO;
const { agentCall, exec: gh } = createSkillHarness(resolve(__dirname, ".."), {
  GITHUB_TOKEN: "TEST_GITHUB_TOKEN",
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1500;

const SETUP_TIMEOUT = AGENT_TIMEOUT * 3;

describe("agent: pull requests", () => {
  let repoInitialized = false;
  const lifecycleBranch = `agent-pr-${Date.now()}`;
  const mergeBranch = `agent-pr-merge-${Date.now()}`;
  let prNumber: number;
  let mergePrNumber: number;

  beforeAll(async () => {
    requireClaude();
    requireLima();
    repoInitialized = await ensureRepoInitialized();
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    if (prNumber) {
      try {
        await gh("pr-close", { repo: GITHUB_REPO, number: prNumber, delete_branch: true });
      } catch {}
    }
  }, AGENT_TIMEOUT);

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

      expectScriptSucceeded(result, "pr-create");

      // Verify via API that the PR actually exists
      const verify = await gh("pr-list", { repo: GITHUB_REPO });
      expect(verify.success).toBe(true);
      const prs = verify.data as any[];
      const created = prs.find((p: any) => p.headRefName === lifecycleBranch);
      expect(created).toBeTruthy();
      prNumber = created.number;
      expect(prNumber).toBeGreaterThan(0);

      // Verify PR details
      const prView = await gh("pr-view", { repo: GITHUB_REPO, number: prNumber });
      expect(prView.success).toBe(true);
      const pr = prView.data as any;
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
        `Use the pr-view script to view pull request #${prNumber} in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "pr-view");

      // Verify via direct API
      const verify = await gh("pr-view", { repo: GITHUB_REPO, number: prNumber });
      expect(verify.success, `pr-view verify failed: ${verify.error}`).toBe(true);
      const data = verify.data as any;
      expect(data.number).toBe(prNumber);
      expect(data.state).toMatch(/OPEN|open/i);
      expect(data.headRefName).toBe(lifecycleBranch);
      expect(data.baseRefName).toBe("main");
      expect(data.author.login).toBeTruthy();
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

      expectScriptSucceeded(result, "pr-list");

      // Verify via direct API
      const verify = await gh("pr-list", { repo: GITHUB_REPO });
      expect(verify.success).toBe(true);
      const data = verify.data as any[];
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

      const call = expectScriptSucceeded(result, "pr-diff");
      expect(call.output.length).toBeGreaterThan(0);
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

      expectScriptSucceeded(result, "pr-checks");

      // Verify via direct API
      const verify = await gh("pr-checks", { repo: GITHUB_REPO, number: prNumber });
      expect(verify.success).toBe(true);
      const data = verify.data;
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

      expectScriptSucceeded(result, "pr-review");

      // Verify the review exists on the PR
      const verify = await gh("pr-view", { repo: GITHUB_REPO, number: prNumber });
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

      expectScriptSucceeded(result, "pr-close");

      // Verify the PR is actually closed (GitHub can be eventually consistent)
      let closed = false;
      for (let retryAttempt = 0; retryAttempt < MAX_RETRY_ATTEMPTS; retryAttempt++) {
        const verify = await gh("pr-view", { repo: GITHUB_REPO, number: prNumber });
        if (verify.success && /CLOSED|closed/i.test((verify.data as any).state ?? "")) {
          closed = true;
          break;
        }
        if (retryAttempt < MAX_RETRY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
      expect(closed).toBe(true);
    },
    AGENT_TIMEOUT
  );

  test(
    "pr-merge",
    async () => {
      // Create a separate PR for merging via direct API
      const mergeTitle = `Agent merge PR ${mergeBranch}`;
      const createResult = await gh("pr-create", {
        repo: GITHUB_REPO,
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

      expectScriptSucceeded(result, "pr-merge");

      // Verify the PR is actually merged
      const verify = await gh("pr-view", { repo: GITHUB_REPO, number: mergePrNumber });
      expect(verify.success).toBe(true);
      expect((verify.data as any).state).toMatch(/MERGED|merged/i);
    },
    AGENT_TIMEOUT * 2
  );
});
