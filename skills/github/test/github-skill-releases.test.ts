/**
 * GitHub Skill — Releases and labels
 */

import { describe, expect, test } from "bun:test";
import { gh, GITHUB_REPO, TIMEOUT } from "./github-helpers";

describe("github skill: releases & labels", () => {
  // Note: gist tests are in github-skill-gists.test.ts (requires TEST_GIST_GITHUB_TOKEN)
  // ── Release lifecycle ──────────────────────────────────────────────

  describe("release lifecycle", () => {
    const releaseTag = `v0.0.0-test-${Date.now()}`;

    test(
      "create a release",
      async () => {
        const result = await gh("release-create", {
          repo: GITHUB_REPO!,
          tag: releaseTag,
          title: `Test Release ${releaseTag}`,
          notes: "This is an automated test release.\n\n- Item 1\n- Item 2",
        });

        if (!result.success) throw new Error(`release-create failed: ${result.error}`);
        const data = result.data as any;
        expect(data.tag).toBe(releaseTag);
        expect(data.url).toContain("github.com");
      },
      TIMEOUT
    );

    test(
      "list releases finds our release",
      async () => {
        const result = await gh("release-list", {
          repo: GITHUB_REPO!,
          limit: 10,
        });

        if (!result.success) throw new Error(`release-list failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThanOrEqual(1);

        const found = data.find((r: any) => r.tagName === releaseTag);
        expect(found).toBeDefined();
        expect(found.isDraft).toBe(false);
        expect(found.isPrerelease).toBe(false);
      },
      TIMEOUT
    );

    test(
      "view the release",
      async () => {
        const result = await gh("release-view", {
          repo: GITHUB_REPO!,
          tag: releaseTag,
        });

        if (!result.success) throw new Error(`release-view failed: ${result.error}`);
        const data = result.data as any;
        expect(data.tagName).toBe(releaseTag);
        expect(data.name).toBe(`Test Release ${releaseTag}`);
        expect(data.body).toContain("automated test release");
        expect(data.isDraft).toBe(false);
        expect(data.assets).toBeInstanceOf(Array);
      },
      TIMEOUT
    );

    test(
      "delete the release and its tag",
      async () => {
        const result = await gh("release-delete", {
          repo: GITHUB_REPO!,
          tag: releaseTag,
          cleanup_tag: true,
        });

        if (!result.success) throw new Error(`release-delete failed: ${result.error}`);
        expect((result.data as any).deleted).toBe(true);

        // Verify it's gone
        const list = await gh("release-list", { repo: GITHUB_REPO!, limit: 50 });
        if (!list.success) {
          throw new Error(`release-list failed: ${list.error}`);
        }
        const data = list.data as any[];
        const found = data.find((r: any) => r.tagName === releaseTag);
        expect(found).toBeUndefined();
      },
      TIMEOUT
    );
  });

  // ── Draft + prerelease ─────────────────────────────────────────────

  describe("draft and prerelease", () => {
    const draftTag = `v0.0.0-draft-${Date.now()}`;
    const prereleaseTag = `v0.0.0-rc-${Date.now()}`;

    test(
      "create a draft release",
      async () => {
        const result = await gh("release-create", {
          repo: GITHUB_REPO!,
          tag: draftTag,
          title: "Draft Release",
          notes: "Draft release notes",
          draft: true,
        });

        if (!result.success) throw new Error(`release-create draft failed: ${result.error}`);

        const view = await gh("release-view", { repo: GITHUB_REPO!, tag: draftTag });
        if (!view.success) throw new Error(`release-view draft failed: ${view.error}`);
        expect((view.data as any).isDraft).toBe(true);

        // Cleanup
        await gh("release-delete", { repo: GITHUB_REPO!, tag: draftTag, cleanup_tag: true });
      },
      TIMEOUT * 2
    );

    test(
      "create a prerelease",
      async () => {
        const result = await gh("release-create", {
          repo: GITHUB_REPO!,
          tag: prereleaseTag,
          title: "Prerelease",
          notes: "Release candidate",
          prerelease: true,
        });

        if (!result.success) throw new Error(`release-create prerelease failed: ${result.error}`);

        const view = await gh("release-view", { repo: GITHUB_REPO!, tag: prereleaseTag });
        if (!view.success) throw new Error(`release-view prerelease failed: ${view.error}`);
        expect((view.data as any).isPrerelease).toBe(true);

        // Cleanup
        await gh("release-delete", { repo: GITHUB_REPO!, tag: prereleaseTag, cleanup_tag: true });
      },
      TIMEOUT * 2
    );
  });

  // ── Label lifecycle ────────────────────────────────────────────────

  describe("label lifecycle", () => {
    const labelName = `test-label-${Date.now()}`;

    test(
      "create a label",
      async () => {
        const result = await gh("label-create", {
          repo: GITHUB_REPO!,
          name: labelName,
          color: "0075ca",
          description: "Created by integration test",
        });

        if (!result.success) throw new Error(`label-create failed: ${result.error}`);
        const data = result.data as any;
        expect(data.created).toBe(true);
        expect(data.name).toBe(labelName);
      },
      TIMEOUT
    );

    test(
      "list labels includes the created label",
      async () => {
        const result = await gh("label-list", { repo: GITHUB_REPO! });

        if (!result.success) throw new Error(`label-list failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);

        const found = data.find((l: any) => l.name === labelName);
        expect(found).toBeDefined();
        expect(found.color).toBe("0075ca");
        expect(found.description).toBe("Created by integration test");
      },
      TIMEOUT
    );

    test(
      "delete the label",
      async () => {
        const result = await gh("label-delete", {
          repo: GITHUB_REPO!,
          name: labelName,
        });

        if (!result.success) throw new Error(`label-delete failed: ${result.error}`);
        expect((result.data as any).deleted).toBe(true);

        // Verify it's gone
        const list = await gh("label-list", { repo: GITHUB_REPO! });
        const data = list.data as any[];
        const found = data.find((l: any) => l.name === labelName);
        expect(found).toBeUndefined();
      },
      TIMEOUT
    );
  });

});
