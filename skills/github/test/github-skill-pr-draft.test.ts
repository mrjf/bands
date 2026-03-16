/**
 * GitHub Skill — Draft PR lifecycle + PR close + PR diff/checks
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { createBranchWithFile, ensureRepoInitialized, gh, GITHUB_REPO, TIMEOUT } from "./github-helpers";

describe("github: draft PR & close", () => {
  let repoInitialized = false;

  beforeAll(async () => {
    repoInitialized = await ensureRepoInitialized();
  }, TIMEOUT);

  // ── Draft PR lifecycle ─────────────────────────────────────────

  describe("draft PR lifecycle", () => {
    let prNumber: number;
    const branchName = `draft-test-${Date.now()}`;

    test("setup: create branch", async () => {
      expect(repoInitialized).toBe(true);
      await createBranchWithFile(branchName);
    }, TIMEOUT * 3);

    test("create a draft PR", async () => {
      const result = await gh("pr-create", {
        repo: GITHUB_REPO!,
        title: `Draft PR [${branchName}]`,
        body: "This is a draft PR",
        head: branchName,
        base: "main",
        draft: true,
      });
      if (!result.success) throw new Error(`pr-create draft failed: ${result.error}`);
      prNumber = (result.data as any).number;
    }, TIMEOUT);

    test("draft PR shows isDraft=true", async () => {
      expect(prNumber).toBeDefined();
      const result = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
      if (!result.success) throw new Error(`pr-view draft failed: ${result.error}`);
      expect((result.data as any).isDraft).toBe(true);
      expect((result.data as any).state).toBe("OPEN");
    }, TIMEOUT);

    test("review draft PR as comment", async () => {
      expect(prNumber).toBeDefined();
      const result = await gh("pr-review", {
        repo: GITHUB_REPO!,
        number: prNumber,
        event: "COMMENT",
        body: "Reviewing my own draft PR.",
      });
      if (!result.success) throw new Error(`pr-review comment failed: ${result.error}`);
      expect((result.data as any).state).toBe("COMMENT");
    }, TIMEOUT);

    test("undraft and merge the PR", async () => {
      expect(prNumber).toBeDefined();
      const [owner, repo] = GITHUB_REPO!.split("/");

      const prInfo = await gh("api", { endpoint: `repos/${owner}/${repo}/pulls/${prNumber}`, method: "GET" });
      if (!prInfo.success) throw new Error(`api GET pr-info failed: ${prInfo.error}`);
      const nodeId = (prInfo.data as any).node_id;

      await gh("api", {
        endpoint: "graphql",
        method: "POST",
        body: {
          query: `mutation { markPullRequestReadyForReview(input: { pullRequestId: "${nodeId}" }) { pullRequest { isDraft } } }`,
        },
      });

      await new Promise((r) => setTimeout(r, 2000));

      const result = await gh("pr-merge", { repo: GITHUB_REPO!, number: prNumber, method: "merge", delete_branch: true });
      if (!result.success) {
        throw new Error(`pr-merge failed: ${result.error}`);
      }
      expect((result.data as any).merged).toBe(true);
    }, TIMEOUT * 2);
  });

  // ── PR close without merge ─────────────────────────────────────

  describe("pr-close", () => {
    let prNumber: number;
    const branchName = `close-test-${Date.now()}`;

    test("setup: create branch and PR", async () => {
      await createBranchWithFile(branchName);
      const pr = await gh("pr-create", {
        repo: GITHUB_REPO!,
        title: `PR to close [${branchName}]`,
        body: "PR for close/delete test",
        head: branchName,
        base: "main",
      });
      if (!pr.success) throw new Error(`pr-create for close-test failed: ${pr.error}`);
      prNumber = (pr.data as any).number;
    }, TIMEOUT * 3);

    test("close PR with comment and delete branch", async () => {
      expect(prNumber).toBeGreaterThan(0);
      const result = await gh("pr-close", {
        repo: GITHUB_REPO!,
        number: prNumber,
        comment: "Closing without merging",
        delete_branch: true,
      });
      if (!result.success) {
        throw new Error(`pr-close failed: ${result.error}`);
      }
      expect((result.data as any).closed).toBe(true);

      const view = await gh("pr-view", { repo: GITHUB_REPO!, number: prNumber });
      expect((view.data as any).state).toBe("CLOSED");
    }, TIMEOUT);
  });

  // ── PR diff and checks ────────────────────────────────────────

  describe("pr-diff and pr-checks", () => {
    test("view diff of a merged PR", async () => {
      const prList = await gh("pr-list", { repo: GITHUB_REPO!, state: "merged", limit: 1 });
      if (!prList.success) throw new Error(`pr-list merged failed: ${prList.error}`);
      const prs = prList.data as any[];
      expect(prs.length).toBeGreaterThan(0);

      const result = await gh("pr-diff", { repo: GITHUB_REPO!, number: prs[0].number });
      if (!result.success) throw new Error(`pr-diff failed: ${result.error}`);
      expect((result.data as any).diff.length).toBeGreaterThan(0);
    }, TIMEOUT);

    test("view diff with name-only", async () => {
      const prList = await gh("pr-list", { repo: GITHUB_REPO!, state: "merged", limit: 1 });
      if (!prList.success) throw new Error(`pr-list merged failed: ${prList.error}`);
      const prs = prList.data as any[];
      expect(prs.length, "no merged PRs to check").toBeGreaterThan(0);

      const result = await gh("pr-diff", { repo: GITHUB_REPO!, number: prs[0].number, name_only: true });
      if (!result.success) throw new Error(`pr-diff name-only failed: ${result.error}`);
      expect((result.data as any).diff.length).toBeGreaterThan(0);
      expect((result.data as any).diff).not.toContain("@@");
    }, TIMEOUT);

    test("check PR checks (may error for no CI)", async () => {
      const prList = await gh("pr-list", { repo: GITHUB_REPO!, state: "merged", limit: 1 });
      if (!prList.success) throw new Error(`pr-list merged failed: ${prList.error}`);
      const prs = prList.data as any[];
      expect(prs.length, "no merged PRs to check").toBeGreaterThan(0);

      const result = await gh("pr-checks", { repo: GITHUB_REPO!, number: prs[0].number });
      if (result.success) {
        expect(result.data as any[]).toBeInstanceOf(Array);
      } else {
        expect(result.error).toBeDefined();
      }
    }, TIMEOUT);
  });
});
