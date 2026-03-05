/**
 * GitHub Skill — Issue lifecycle (create, view, comment, list, close)
 */

import { describe, expect, test } from "bun:test";
import { canRun, gh, GITHUB_REPO, TIMEOUT } from "./github-helpers";

if (!canRun) console.warn("Skipping: GITHUB_TEST_TOKEN or GITHUB_TEST_REPO not set");

describe.skipIf(!canRun)("github: issue lifecycle", () => {
  let createdIssueNumber: number;
  const uniqueTag = `test-${Date.now()}`;
  const issueTitle = `Integration test issue [${uniqueTag}]`;

  test("create an issue", async () => {
    const result = await gh("issue-create", {
      repo: GITHUB_REPO!,
      title: issueTitle,
      body: `Automated integration test.\n\nTag: ${uniqueTag}`,
    });
    if (!result.success) throw new Error(`issue-create failed: ${result.error}`);
    const data = result.data as any;
    expect(data.number).toBeGreaterThan(0);
    expect(data.url).toContain("github.com");
    createdIssueNumber = data.number;
  }, TIMEOUT);

  test("view the created issue", async () => {
    expect(createdIssueNumber).toBeDefined();
    const result = await gh("issue-view", { repo: GITHUB_REPO!, number: createdIssueNumber, comments: false });
    if (!result.success) throw new Error(`issue-view failed: ${result.error}`);
    const data = result.data as any;
    expect(data.number).toBe(createdIssueNumber);
    expect(data.title).toBe(issueTitle);
    expect(data.state).toBe("OPEN");
    expect(data.body).toContain(uniqueTag);
  }, TIMEOUT);

  test("comment on the issue", async () => {
    expect(createdIssueNumber).toBeDefined();
    const result = await gh("issue-comment", {
      repo: GITHUB_REPO!,
      number: createdIssueNumber,
      body: `Automated comment.\n\nTimestamp: ${new Date().toISOString()}`,
    });
    if (!result.success) throw new Error(`issue-comment failed: ${result.error}`);
    expect((result.data as any).url).toContain("github.com");
  }, TIMEOUT);

  test("view issue with comments", async () => {
    expect(createdIssueNumber).toBeDefined();
    const result = await gh("issue-view", { repo: GITHUB_REPO!, number: createdIssueNumber, comments: true });
    if (!result.success) throw new Error(`issue-view with comments failed: ${result.error}`);
    const data = result.data as any;
    expect(data.comments).toBeInstanceOf(Array);
    expect(data.comments.length).toBeGreaterThanOrEqual(1);
    expect(data.comments[0].body).toContain("Automated comment");
  }, TIMEOUT);

  test("list issues finds the created issue", async () => {
    const result = await gh("issue-list", { repo: GITHUB_REPO!, state: "open", limit: 100 });
    if (!result.success) throw new Error(`issue-list open failed: ${result.error}`);
    const data = result.data as any[];
    const found = data.find((i: any) => i.number === createdIssueNumber);
    expect(found).toBeDefined();
    expect(found.title).toBe(issueTitle);
  }, TIMEOUT);

  test("close the issue", async () => {
    expect(createdIssueNumber).toBeDefined();
    const [owner, repo] = GITHUB_REPO!.split("/");
    const result = await gh("api", {
      endpoint: `repos/${owner}/${repo}/issues/${createdIssueNumber}`,
      method: "PATCH",
      body: { state: "closed" },
    });
    if (!result.success) throw new Error(`api issue-close failed: ${result.error}`);
    expect((result.data as any).state).toBe("closed");
  }, TIMEOUT);

  // ── Filters ─────────────────────────────────────────────────

  test("list issues with state=all", async () => {
    const result = await gh("issue-list", { repo: GITHUB_REPO!, state: "all", limit: 50 });
    if (!result.success) throw new Error(`issue-list all failed: ${result.error}`);
    const data = result.data as any[];
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);
  }, TIMEOUT);

  test("list issues with limit=1 returns exactly 1", async () => {
    const result = await gh("issue-list", { repo: GITHUB_REPO!, state: "all", limit: 1 });
    if (!result.success) throw new Error(`issue-list limit=1 failed: ${result.error}`);
    expect(result.data as any[]).toHaveLength(1);
  }, TIMEOUT);
});
