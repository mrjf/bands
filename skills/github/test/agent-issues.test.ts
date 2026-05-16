import { describe, test, expect, beforeAll, afterAll } from "bun:test";
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1500;

describe("agent: issues", () => {
  beforeAll(() => {
    requireClaude();
    requireLima();
  });

  const uniqueTag = `agent-test-${Date.now()}`;
  const issueTitle = `Agent test ${uniqueTag}`;
  let issueNumber: number;

  afterAll(async () => {
    if (issueNumber) {
      await gh("issue-close", { repo: GITHUB_REPO, number: issueNumber });
    }
  }, AGENT_TIMEOUT);

  test(
    "issue-create",
    async () => {
      const result = await agentCall(
        `Create an issue titled '${issueTitle}' with body 'Automated agent test' in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-create");

      // Verify the issue was actually created via direct API
      const verify = await gh("issue-list", { repo: GITHUB_REPO });
      expect(verify.success).toBe(true);
      const issues = verify.data as any[];
      const created = issues.find((i: any) => i.title === issueTitle);
      expect(created).toBeTruthy();
      issueNumber = created.number;
      expect(issueNumber).toBeGreaterThan(0);
    },
    AGENT_TIMEOUT
  );

  test(
    "issue-view",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `View issue #${issueNumber} in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-view");

      // Verify via direct API
      const verify = await gh("issue-view", { repo: GITHUB_REPO, number: issueNumber });
      expect(verify.success).toBe(true);
      const data = verify.data as any;
      expect(data.title).toBe(issueTitle);
      expect(data.number).toBe(issueNumber);
      expect(data.state).toMatch(/OPEN|open/i);
    },
    AGENT_TIMEOUT
  );

  test(
    "issue-comment",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const commentBody = `Automated agent test comment ${uniqueTag}`;
      const result = await agentCall(
        `Comment '${commentBody}' on issue #${issueNumber} in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-comment");

      // Verify the comment exists via API
      const verify = await gh("issue-view", {
        repo: GITHUB_REPO,
        number: issueNumber,
        comments: true,
      });
      expect(verify.success).toBe(true);
      const comments = (verify.data as any).comments;
      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThan(0);
      const lastComment = comments[comments.length - 1];
      expect(lastComment.body).toContain(commentBody);
    },
    AGENT_TIMEOUT
  );

  test(
    "issue-list",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `List open issues in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-list");

      // Verify via direct API
      const verify = await gh("issue-list", { repo: GITHUB_REPO });
      expect(verify.success).toBe(true);
      const data = verify.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our created issue should be in the list
      const found = data.find((i: any) => i.number === issueNumber);
      expect(found).toBeTruthy();
      expect(found.state).toMatch(/OPEN|open/i);
    },
    AGENT_TIMEOUT
  );

  test(
    "issue-edit",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const updatedTitle = `Updated ${uniqueTag}`;
      const result = await agentCall(
        `Change the title of issue #${issueNumber} to '${updatedTitle}' in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-edit");

      // Verify the title actually changed (GitHub can be eventually consistent)
      let updated = false;
      for (let retryAttempt = 0; retryAttempt < MAX_RETRY_ATTEMPTS; retryAttempt++) {
        const verify = await gh("issue-view", { repo: GITHUB_REPO, number: issueNumber });
        if (verify.success && (verify.data as any).title === updatedTitle) {
          updated = true;
          break;
        }
        if (retryAttempt < MAX_RETRY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
      expect(updated).toBe(true);
    },
    AGENT_TIMEOUT
  );

  test(
    "issue-close",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `Close issue #${issueNumber} in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-close");

      // Verify the issue is actually closed
      const verify = await gh("issue-view", { repo: GITHUB_REPO, number: issueNumber });
      expect(verify.success).toBe(true);
      expect((verify.data as any).state).toMatch(/CLOSED|closed/i);
    },
    AGENT_TIMEOUT
  );

  test(
    "issue-reopen",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const result = await agentCall(
        `Reopen issue #${issueNumber} in ${GITHUB_REPO}`
      );

      expectScriptSucceeded(result, "issue-reopen");

      // Verify the issue is actually open again (GitHub can be eventually consistent)
      let reopened = false;
      for (let retryAttempt = 0; retryAttempt < MAX_RETRY_ATTEMPTS; retryAttempt++) {
        const verify = await gh("issue-view", { repo: GITHUB_REPO, number: issueNumber });
        if (verify.success && /OPEN|open/i.test((verify.data as any).state ?? "")) {
          reopened = true;
          break;
        }
        if (retryAttempt < MAX_RETRY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
      expect(reopened).toBe(true);
    },
    AGENT_TIMEOUT
  );
});
