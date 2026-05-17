/**
 * GitHub Skill — Issue edit, close/reopen, labels+assignees
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { gh, GITHUB_REPO, TIMEOUT } from "./github-helpers";

const MAX_VISIBILITY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("github: issue edit & close/reopen", () => {
  // ── Labels + assignees ──────────────────────────────────────────

  describe("issue with labels and assignees", () => {
    let labelName: string;
    let issueNumber: number;

    beforeAll(async () => {
      const [owner, repo] = GITHUB_REPO!.split("/");
      labelName = `integ-${Date.now()}`;
      const lr = await gh("api", {
        endpoint: `repos/${owner}/${repo}/labels`,
        method: "POST",
        body: { name: labelName, color: "0e8a16", description: "Integration test label" },
      });
      if (!lr.success) throw new Error(`api label-create failed: ${lr.error}`);
    }, TIMEOUT);

    test("create issue with label and assignee", async () => {
      const result = await gh("issue-create", {
        repo: GITHUB_REPO!,
        title: `Labeled issue [${labelName}]`,
        body: "Issue with label attached",
        labels: [labelName],
        assignees: [GITHUB_REPO!.split("/")[0]],
      });
      if (!result.success) throw new Error(`issue-create with labels failed: ${result.error}`);
      issueNumber = (result.data as any).number;
    }, TIMEOUT);

    test("view issue shows label and assignee", async () => {
      expect(issueNumber).toBeDefined();
      let issueData: { labels: Array<{ name: string }>; assignees: unknown[] } | undefined;
      for (let attempt = 0; attempt < MAX_VISIBILITY_ATTEMPTS; attempt++) {
        const result = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
        if (!result.success) throw new Error(`issue-view labels failed: ${result.error}`);
        issueData = result.data as { labels: Array<{ name: string }>; assignees: unknown[] };
        if (issueData.labels.some((l) => l.name === labelName) && issueData.assignees.length >= 1) break;
        if (attempt < MAX_VISIBILITY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
      }
      if (!issueData) throw new Error("issue-view did not return data");
      expect(issueData.labels.some((l) => l.name === labelName)).toBe(true);
      expect(issueData.assignees.length).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);

    test("list issues filtered by assignee", async () => {
      const owner = GITHUB_REPO!.split("/")[0];
      const result = await gh("issue-list", { repo: GITHUB_REPO!, assignee: owner, state: "open" });
      if (!result.success) throw new Error(`issue-list by assignee failed: ${result.error}`);
      expect((result.data as any[]).length).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);

    test("multiple comments on one issue", async () => {
      expect(issueNumber).toBeDefined();
      for (let i = 1; i <= 3; i++) {
        const result = await gh("issue-comment", {
          repo: GITHUB_REPO!,
          number: issueNumber,
          body: `Comment #${i} at ${new Date().toISOString()}`,
        });
        if (!result.success) throw new Error(`issue-comment #${i} failed: ${result.error}`);
      }
      const view = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber, comments: true });
      if (!view.success) throw new Error(`issue-view comments failed: ${view.error}`);
      expect((view.data as any).comments.length).toBeGreaterThanOrEqual(3);
    }, TIMEOUT * 2);

    test("close issue and verify in closed list", async () => {
      const [owner, repo] = GITHUB_REPO!.split("/");
      await gh("api", {
        endpoint: `repos/${owner}/${repo}/issues/${issueNumber}`,
        method: "PATCH",
        body: { state: "closed" },
      });
      const listResult = await gh("issue-list", { repo: GITHUB_REPO!, state: "closed", limit: 50 });
      if (!listResult.success) throw new Error(`issue-list closed failed: ${listResult.error}`);
      expect((listResult.data as any[]).find((i: any) => i.number === issueNumber)).toBeDefined();
    }, TIMEOUT);

    test("cleanup: delete test label", async () => {
      const [owner, repo] = GITHUB_REPO!.split("/");
      const result = await gh("api", {
        endpoint: `repos/${owner}/${repo}/labels/${labelName}`,
        method: "DELETE",
      });
      if (!result.success) throw new Error(`api label-delete cleanup failed: ${result.error}`);
    }, TIMEOUT);
  });

  // ── issue-edit ──────────────────────────────────────────────────

  describe("issue-edit", () => {
    let issueNumber: number;
    let editLabelName: string;

    beforeAll(async () => {
      editLabelName = `edit-label-${Date.now()}`;
      await gh("label-create", { repo: GITHUB_REPO!, name: editLabelName, color: "d73a4a", description: "For edit testing" });
      const create = await gh("issue-create", { repo: GITHUB_REPO!, title: "Issue to edit", body: "Original body" });
      issueNumber = (create.data as any).number;
    }, TIMEOUT * 2);

    test("edit issue title and body", async () => {
      const result = await gh("issue-edit", { repo: GITHUB_REPO!, number: issueNumber, title: "Edited issue title", body: "Edited body content" });
      if (!result.success) throw new Error(`issue-edit title/body failed: ${result.error}`);
      const view = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect((view.data as any).title).toBe("Edited issue title");
      expect((view.data as any).body).toContain("Edited body");
    }, TIMEOUT);

    test("add label to issue", async () => {
      const result = await gh("issue-edit", { repo: GITHUB_REPO!, number: issueNumber, add_labels: [editLabelName] });
      if (!result.success) throw new Error(`issue-edit add-label failed: ${result.error}`);
      const view = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect((view.data as any).labels.some((l: any) => l.name === editLabelName)).toBe(true);
    }, TIMEOUT);

    test("remove label from issue", async () => {
      const result = await gh("issue-edit", { repo: GITHUB_REPO!, number: issueNumber, remove_labels: [editLabelName] });
      if (!result.success) throw new Error(`issue-edit remove-label failed: ${result.error}`);
      const view = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect((view.data as any).labels.some((l: any) => l.name === editLabelName)).toBe(false);
    }, TIMEOUT);

    test("cleanup edit test resources", async () => {
      await gh("issue-close", { repo: GITHUB_REPO!, number: issueNumber });
      await gh("label-delete", { repo: GITHUB_REPO!, name: editLabelName });
    }, TIMEOUT);
  });

  // ── close/reopen lifecycle ──────────────────────────────────────

  describe("issue close/reopen lifecycle", () => {
    let issueNumber: number;

    beforeAll(async () => {
      const create = await gh("issue-create", {
        repo: GITHUB_REPO!,
        title: `Close/reopen test ${Date.now()}`,
        body: "Testing close and reopen",
      });
      issueNumber = (create.data as any).number;
    }, TIMEOUT);

    test("close issue as completed with comment", async () => {
      const result = await gh("issue-close", {
        repo: GITHUB_REPO!,
        number: issueNumber,
        reason: "completed",
        comment: "Closing as completed for testing",
      });
      if (!result.success) throw new Error(`issue-close completed failed: ${result.error}`);
      expect((result.data as any).closed).toBe(true);

      const view = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber, comments: true });
      expect((view.data as any).state).toBe("CLOSED");
      expect((view.data as any).comments.some((c: any) => c.body.includes("Closing as completed"))).toBe(true);
    }, TIMEOUT);

    test("reopen the issue with comment", async () => {
      const result = await gh("issue-reopen", {
        repo: GITHUB_REPO!,
        number: issueNumber,
        comment: "Reopening for further testing",
      });
      if (!result.success) throw new Error(`issue-reopen failed: ${result.error}`);
      expect((result.data as any).reopened).toBe(true);

      const view = await gh("issue-view", { repo: GITHUB_REPO!, number: issueNumber });
      expect((view.data as any).state).toBe("OPEN");
    }, TIMEOUT);

    test("close as not planned", async () => {
      const result = await gh("issue-close", { repo: GITHUB_REPO!, number: issueNumber, reason: "not planned" });
      if (!result.success) throw new Error(`issue-close not-planned failed: ${result.error}`);
    }, TIMEOUT);
  });

  // ── close already-closed issue ─────────────────────────────────

  test("close already-closed issue still succeeds", async () => {
    const list = await gh("issue-list", { repo: GITHUB_REPO!, state: "closed", limit: 1 });
    if (!list.success) throw new Error(`issue-list closed failed: ${list.error}`);
    const issues = list.data as any[];
    if (issues.length === 0) return;
    const result = await gh("issue-close", { repo: GITHUB_REPO!, number: issues[0].number });
    if (!result.success) throw new Error(`issue-close already-closed failed: ${result.error}`);
  }, TIMEOUT);
});
