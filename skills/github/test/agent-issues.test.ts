import { describe, test, expect, afterAll } from "bun:test";
import {
  agentCall,
  AGENT_TIMEOUT,
  GITHUB_REPO,
  gh,
} from "./agent-helpers";

describe("agent: issues", () => {
  const uniqueTag = `agent-test-${Date.now()}`;
  const issueTitle = `Agent test ${uniqueTag}`;
  let issueNumber: number;

  afterAll(async () => {
    if (issueNumber) {
      await gh("issue-close", { repo: GITHUB_REPO!, number: issueNumber });
    }
  });

  test(
    "issue-create",
    async () => {
      const result = await agentCall(
        `Create an issue titled '${issueTitle}' with body 'Automated agent test' in ${GITHUB_REPO}`
      );

      // Agent picked the right tool with correct params
      expect(result.toolName).toBe("issue-create");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.title).toBe(issueTitle);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      issueNumber = data.number;
      expect(issueNumber).toBeGreaterThan(0);
      expect(data.url).toContain("github.com");
      expect(data.title).toBe(issueTitle);

      // Verify via API that the issue actually exists
      const verify = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect(verify.success).toBe(true);
      const issue = verify.data as any;
      expect(issue.title).toBe(issueTitle);
      expect(issue.state).toMatch(/OPEN|open/i);
      expect(issue.number).toBe(issueNumber);
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

      expect(result.toolName).toBe("issue-view");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(issueNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.title).toBe(issueTitle);
      expect(data.number).toBe(issueNumber);
      expect(data.state).toMatch(/OPEN|open/i);
      expect(data.url).toContain(`${issueNumber}`);
      expect(data.author.login).toBeTruthy();
      expect(data.createdAt).toBeTruthy();
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

      expect(result.toolName).toBe("issue-comment");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(issueNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.url).toContain("github.com");

      // Verify the comment exists via API
      const verify = await gh("issue-view", {
        repo: GITHUB_REPO!,
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

      expect(result.toolName).toBe("issue-list");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our created issue should be in the list
      const found = data.find((i: any) => i.number === issueNumber);
      expect(found).toBeTruthy();
      expect(found.state).toMatch(/OPEN|open/i);
      expect(found.url).toContain("github.com");

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
    "issue-edit",
    async () => {
      expect(issueNumber, "issue-create must succeed first").toBeGreaterThan(0);
      const updatedTitle = `Updated ${uniqueTag}`;
      const result = await agentCall(
        `Change the title of issue #${issueNumber} to '${updatedTitle}' in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("issue-edit");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(issueNumber);
      expect(result.toolInput.title).toBe(updatedTitle);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.edited).toBe(true);
      expect(data.number).toBe(issueNumber);

      // Verify the title actually changed
      const verify = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect(verify.success).toBe(true);
      expect((verify.data as any).title).toBe(updatedTitle);
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

      expect(result.toolName).toBe("issue-close");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(issueNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.closed).toBe(true);
      expect(data.number).toBe(issueNumber);

      // Verify the issue is actually closed
      const verify = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
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

      expect(result.toolName).toBe("issue-reopen");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.number).toBe(issueNumber);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.reopened).toBe(true);
      expect(data.number).toBe(issueNumber);

      // Verify the issue is actually open again
      const verify = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect(verify.success).toBe(true);
      expect((verify.data as any).state).toMatch(/OPEN|open/i);
    },
    AGENT_TIMEOUT
  );
});
