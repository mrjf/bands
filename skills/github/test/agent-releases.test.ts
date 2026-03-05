import { describe, test, expect, afterAll } from "bun:test";
import {
  agentCall,
  AGENT_TIMEOUT,
  GITHUB_REPO,
  gh,
} from "./agent-helpers";

describe("agent: releases", () => {
  const tag = `v0.0.0-agent-${Date.now()}`;
  const releaseTitle = "Agent Test Release";

  afterAll(async () => {
    try {
      await gh("release-delete", { repo: GITHUB_REPO!, tag, cleanup_tag: true });
    } catch {}
  });

  test(
    "release-create",
    async () => {
      const result = await agentCall(
        `Create a release with tag ${tag} titled '${releaseTitle}' in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("release-create");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.tag).toBe(tag);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.tag).toBe(tag);
      expect(data.url).toContain("github.com");

      // Verify the release actually exists
      const verify = await gh("release-view", { repo: GITHUB_REPO!, tag });
      expect(verify.success).toBe(true);
      const release = verify.data as any;
      expect(release.tagName).toBe(tag);
      expect(release.name).toBe(releaseTitle);
      expect(release.url).toContain("github.com");
    },
    AGENT_TIMEOUT
  );

  test(
    "release-list",
    async () => {
      const result = await agentCall(
        `List releases in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("release-list");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Our release should be in the list
      const found = data.find((r: any) => r.tagName === tag);
      expect(found).toBeTruthy();
      expect(found.name).toBe(releaseTitle);

      // Every item should have expected shape
      for (const item of data) {
        expect(typeof item.tagName).toBe("string");
        expect(typeof item.isDraft).toBe("boolean");
        expect(typeof item.isPrerelease).toBe("boolean");
      }
    },
    AGENT_TIMEOUT
  );

  test(
    "release-view",
    async () => {
      const result = await agentCall(
        `View the release tagged ${tag} in ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("release-view");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.tag).toBe(tag);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.tagName).toBe(tag);
      expect(data.name).toBe(releaseTitle);
      expect(data.isDraft).toBe(false);
      expect(data.isPrerelease).toBe(false);
      expect(data.url).toContain("github.com");
      expect(data.author).toBeTruthy();
      expect(data.author.login).toBeTruthy();
    },
    AGENT_TIMEOUT
  );

  test(
    "release-delete",
    async () => {
      const result = await agentCall(
        `Delete the release tagged ${tag} from ${GITHUB_REPO}`
      );

      expect(result.toolName).toBe("release-delete");
      expect(result.toolInput.repo).toBe(GITHUB_REPO);
      expect(result.toolInput.tag).toBe(tag);
      expect(result.execResult.success).toBe(true);

      const data = result.execResult.data as any;
      expect(data.deleted).toBe(true);
      expect(data.tag).toBe(tag);

      // Verify the release is actually gone
      const verify = await gh("release-view", { repo: GITHUB_REPO!, tag });
      expect(verify.success).toBe(false);
    },
    AGENT_TIMEOUT
  );
});
