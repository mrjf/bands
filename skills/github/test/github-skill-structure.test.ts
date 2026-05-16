/**
 * GitHub Skill — Structure validation, help, repo-view, run-list, error handling
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseBandMd } from "../../../packages/format/src/parse";
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";
import { validateBandedSkill } from "../../../packages/runtime/src/banded-skills/validator";
import { gh, GITHUB_REPO, RESOURCES, SKILL_ROOT, TIMEOUT } from "./github-helpers";

describe("github skill: structure & basics", () => {
  test("skill structure validates", () => {
    const result = validateBandedSkill(SKILL_ROOT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("BAND.md restricts network hosts", () => {
    const bandMd = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    const result = parseBandMd(bandMd);
    expect(result.document.allow?.net).toEqual([
      "api.github.com",
      "*.githubusercontent.com",
      "uploads.github.com",
    ]);
  });

  test("--help works for every script", async () => {
    const scripts = [
      "issue-list", "issue-create", "issue-view", "issue-comment",
      "issue-edit", "issue-close", "issue-reopen",
      "pr-list", "pr-create", "pr-view", "pr-diff", "pr-checks",
      "pr-merge", "pr-review", "pr-close",
      "release-create", "release-list", "release-view", "release-delete",
      "label-list", "label-create", "label-delete",
      "gist-create", "gist-list", "gist-view", "gist-delete",
      "repo-view", "search", "run-list", "run-view", "api",
    ];

    for (const script of scripts) {
      const result = await bandExec({
        resourceDir: join(RESOURCES, script),
        args: {},
        help: true,
        skillRoot: SKILL_ROOT,
      });
      if (!result.success) throw new Error(`${script} --help failed: ${result.error}`);
      expect(typeof result.data).toBe("string");
      expect(result.data as string).toContain(script);
    }
  });

  test(
    "views test repo metadata",
    async () => {
      const result = await gh("repo-view", { repo: GITHUB_REPO! });
      if (!result.success) throw new Error(`repo-view failed: ${result.error}`);
      const data = result.data as any;
      expect(data.name).toBe(GITHUB_REPO!.split("/")[1]);
      expect(data.url).toContain("github.com");
      expect(typeof data.stars).toBe("number");
      expect(typeof data.forks).toBe("number");
      expect(data.visibility).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "lists workflow runs (may be empty)",
    async () => {
      const result = await gh("run-list", { repo: GITHUB_REPO!, limit: 5 });
      if (!result.success) throw new Error(`run-list failed: ${result.error}`);
      const data = result.data as any[];
      expect(data).toBeInstanceOf(Array);
    },
    TIMEOUT
  );

  // ── Error handling ─────────────────────────────────────────────────

  test(
    "nonexistent repo returns error",
    async () => {
      const result = await gh("repo-view", { repo: "nonexistent-user-xyz/nonexistent-repo-abc" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "invalid issue number returns error",
    async () => {
      const result = await gh("issue-view", { repo: GITHUB_REPO!, number: 999999 });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "invalid API endpoint returns error",
    async () => {
      const result = await gh("api", { endpoint: "repos/nonexistent/nonexistent/nonexistent", method: "GET" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "delete nonexistent label returns error",
    async () => {
      const result = await gh("label-delete", { repo: GITHUB_REPO!, name: `nonexistent-${Date.now()}` });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "view nonexistent release returns error",
    async () => {
      const result = await gh("release-view", { repo: GITHUB_REPO!, tag: "v999.999.999-fake" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "view nonexistent gist returns error",
    async () => {
      const result = await gh("gist-view", { id: "0000000000000000000000000000000" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "close nonexistent PR returns error",
    async () => {
      const result = await gh("pr-close", { repo: GITHUB_REPO!, number: 999999 });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );

  test(
    "reopen nonexistent issue returns error",
    async () => {
      const result = await gh("issue-reopen", { repo: GITHUB_REPO!, number: 999999 });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    },
    TIMEOUT
  );
});
