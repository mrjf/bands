/**
 * GitHub Skill — PR lifecycle (create, view, list, review, merge) + filters
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { canRun, createBranchWithFile, ensureRepoInitialized, gh, GITHUB_REPO, TIMEOUT } from "./github-helpers";

if (!canRun) console.warn("Skipping: GITHUB_TEST_TOKEN or GITHUB_TEST_REPO not set");

describe.skipIf(!canRun)("github: PR lifecycle", () => {
  let repoInitialized = false;

  beforeAll(async () => {
    repoInitialized = await ensureRepoInitialized();
  }, TIMEOUT);

  let prNumber: number;
  const branchName = `test-branch-${Date.now()}`;
  const prTitle = `Integration test PR [${branchName}]`;

  test("setup: create branch with file", async () => {
    expect(repoInitialized).toBe(true);
    await createBranchWithFile(branchName);
  }, TIMEOUT * 3);

  test("create a pull request", async () => {
    const result = await gh("pr-create", {
      repo: GITHUB_REPO!,
      title: prTitle,
      body: `Automated PR.\n\nBranch: ${branchName}`,
      head: branchName,
      base: "main",
    });
    if (!result.success) throw new Error(`pr-create failed: ${result.error}`);
    const data = result.data as any;
    expect(data.number).toBeGreaterThan(0);
    expect(data.url).toContain("github.com");
    prNumber = data.number;
  }, TIMEOUT);

  test("view the pull request", async () => {
    expect(prNumber).toBeDefined();
    const result = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
    if (!result.success) {
      throw new Error(`pr-view failed: ${result.error}`);
    }
    const data = result.data as any;
    expect(data.number).toBe(prNumber);
    expect(data.title).toBe(prTitle);
    expect(data.headRefName).toBe(branchName);
    expect(data.baseRefName).toBe("main");
    expect(data.state).toBe("OPEN");
  }, TIMEOUT);

  test("list PRs finds the created PR", async () => {
    const result = await gh("pr-list", { repo: GITHUB_REPO!, state: "open" });
    if (!result.success) throw new Error(`pr-list open failed: ${result.error}`);
    const found = (result.data as any[]).find((p: any) => p.number === prNumber);
    expect(found).toBeDefined();
    expect(found.title).toBe(prTitle);
  }, TIMEOUT);

  test("review the PR with a comment", async () => {
    expect(prNumber).toBeDefined();
    const result = await gh("pr-review", {
      repo: GITHUB_REPO!,
      number: prNumber,
      event: "COMMENT",
      body: "Automated review comment.",
    });
    if (!result.success) throw new Error(`pr-review comment failed: ${result.error}`);
    expect((result.data as any).state).toBe("COMMENT");
  }, TIMEOUT);

  test("view PR with comments shows the review", async () => {
    expect(prNumber).toBeDefined();
    const result = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber, comments: true });
    if (!result.success) throw new Error(`pr-view with comments failed: ${result.error}`);
    expect((result.data as any).reviews).toBeInstanceOf(Array);
    expect((result.data as any).reviews.length).toBeGreaterThanOrEqual(1);
  }, TIMEOUT);

  test("merge the PR with squash", async () => {
    expect(prNumber).toBeDefined();
    const result = await gh("pr-merge", {
      repo: GITHUB_REPO!,
      number: prNumber,
      method: "squash",
      delete_branch: true,
    });
    if (!result.success) throw new Error(`pr-merge squash failed: ${result.error}`);
    expect((result.data as any).merged).toBe(true);
  }, TIMEOUT);

  test("PR is no longer open after merge", async () => {
    expect(prNumber).toBeDefined();
    const result = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
    if (!result.success) throw new Error(`pr-view after merge failed: ${result.error}`);
    expect((result.data as any).state).toBe("MERGED");
  }, TIMEOUT);

  // ── Filters (depend on merged PRs existing) ────────────────────

  test("list merged PRs", async () => {
    const result = await gh("pr-list", { repo: GITHUB_REPO!, state: "merged", limit: 10 });
    if (!result.success) throw new Error(`pr-list merged failed: ${result.error}`);
    expect((result.data as any[]).length).toBeGreaterThan(0);
  }, TIMEOUT);

  test("list PRs filtered by base branch", async () => {
    const result = await gh("pr-list", { repo: GITHUB_REPO!, state: "all", base: "main", limit: 10 });
    if (!result.success) throw new Error(`pr-list by base failed: ${result.error}`);
    for (const pr of result.data as any[]) {
      expect(pr.baseRefName).toBe("main");
    }
  }, TIMEOUT);
});
