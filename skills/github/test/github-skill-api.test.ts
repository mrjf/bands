/**
 * GitHub Skill — Raw API, file CRUD, search operations
 */

import { describe, expect, test } from "bun:test";
import { gh, requireGitHubEnv, TIMEOUT } from "./github-helpers";

describe("github skill: api & search", () => {
  // ── Raw API ────────────────────────────────────────────────────────

  describe("api", () => {
    test(
      "GET repo info via raw API",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}`,
          method: "GET",
        });

        if (!result.success) throw new Error(`api GET repo failed: ${result.error}`);
        const data = result.data as any;
        expect(data.full_name).toBe(requireGitHubEnv().repo);
        expect(data.html_url).toContain("github.com");
      },
      TIMEOUT
    );

    test(
      "create and delete a label via raw API",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const labelName = `test-label-${Date.now()}`;

        const createResult = await gh("api", {
          endpoint: `repos/${owner}/${repo}/labels`,
          method: "POST",
          body: {
            name: labelName,
            color: "ff0000",
            description: "Temporary test label",
          },
        });

        if (!createResult.success) throw new Error(`api POST label-create failed: ${createResult.error}`);
        const created = createResult.data as any;
        expect(created.name).toBe(labelName);

        const deleteResult = await gh("api", {
          endpoint: `repos/${owner}/${repo}/labels/${labelName}`,
          method: "DELETE",
        });

        if (!deleteResult.success) throw new Error(`api DELETE label failed: ${deleteResult.error}`);
      },
      TIMEOUT
    );
  });

  // ── API advanced operations ─────────────────────────────────────

  describe("api advanced", () => {
    test(
      "list repo branches",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/branches?per_page=100`,
          method: "GET",
        });

        if (!result.success) throw new Error(`api GET branches failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThanOrEqual(1);
        const main = data.find((b: any) => b.name === "main");
        expect(main).toBeDefined();
        expect(main.commit.sha).toBeDefined();
      },
      TIMEOUT
    );

    test(
      "list commits on main",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/commits?per_page=5`,
          method: "GET",
        });

        if (!result.success) throw new Error(`api GET commits failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].sha).toBeDefined();
        expect(data[0].commit.message).toBeDefined();
      },
      TIMEOUT
    );

    test(
      "get authenticated user info",
      async () => {
        const result = await gh("api", {
          endpoint: "user",
          method: "GET",
        });

        if (!result.success) throw new Error(`api GET user failed: ${result.error}`);
        const data = result.data as any;
        expect(data.login).toBeDefined();
        expect(data.id).toBeGreaterThan(0);
      },
      TIMEOUT
    );

    test(
      "list repo contributors",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/contributors`,
          method: "GET",
        });

        if (!result.success) throw new Error(`api GET contributors failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThanOrEqual(1);
        expect(data[0].login).toBeDefined();
        expect(data[0].contributions).toBeGreaterThan(0);
      },
      TIMEOUT
    );

    test(
      "get repo topics via API",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");

        await gh("api", {
          endpoint: `repos/${owner}/${repo}/topics`,
          method: "PUT",
          body: { names: ["integration-test", "bands"] },
        });

        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/topics`,
          method: "GET",
        });

        if (!result.success) throw new Error(`api GET topics failed: ${result.error}`);
        const data = result.data as any;
        expect(data.names).toBeInstanceOf(Array);
        expect(data.names).toContain("integration-test");
        expect(data.names).toContain("bands");
      },
      TIMEOUT
    );
  });

  // ── File CRUD via API ──────────────────────────────────────────────

  describe("file CRUD via api script", () => {
    const fileName = `api-test-${Date.now()}.md`;
    let fileSha: string;

    test(
      "create a file",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const content = Buffer.from(`# Created by integration test\n\nTimestamp: ${new Date().toISOString()}\n`).toString("base64");

        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/contents/${fileName}`,
          method: "PUT",
          body: { message: `test: create ${fileName}`, content },
        });

        if (!result.success) throw new Error(`api file-create failed: ${result.error}`);
        const data = result.data as any;
        expect(data.content.name).toBe(fileName);
        expect(data.content.path).toBe(fileName);
        fileSha = data.content.sha;
      },
      TIMEOUT
    );

    test(
      "read the file back",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");

        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/contents/${fileName}`,
          method: "GET",
        });

        if (!result.success) throw new Error(`api file-read failed: ${result.error}`);
        const data = result.data as any;
        expect(data.name).toBe(fileName);
        expect(data.type).toBe("file");
        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        expect(decoded).toContain("Created by integration test");
      },
      TIMEOUT
    );

    test(
      "update the file",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");
        const newContent = Buffer.from(`# Updated\n\nUpdated at ${new Date().toISOString()}\n`).toString("base64");

        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/contents/${fileName}`,
          method: "PUT",
          body: {
            message: `test: update ${fileName}`,
            content: newContent,
            sha: fileSha,
          },
        });

        if (!result.success) throw new Error(`api file-update failed: ${result.error}`);
        const data = result.data as any;
        expect(data.content.sha).not.toBe(fileSha);
        fileSha = data.content.sha;
      },
      TIMEOUT
    );

    test(
      "delete the file",
      async () => {
        const [owner, repo] = requireGitHubEnv().repo.split("/");

        const result = await gh("api", {
          endpoint: `repos/${owner}/${repo}/contents/${fileName}`,
          method: "DELETE",
          body: {
            message: `test: delete ${fileName}`,
            sha: fileSha,
          },
        });

        if (!result.success) throw new Error(`api file-delete failed: ${result.error}`);
      },
      TIMEOUT
    );
  });

  // ── Search ─────────────────────────────────────────────────────────

  describe("search", () => {
    test(
      "search repos",
      async () => {
        const result = await gh("search", {
          query: "bun runtime language:typescript",
          type: "repos",
          limit: 3,
        });

        if (!result.success) throw new Error(`search repos failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].fullName).toBeDefined();
      },
      TIMEOUT
    );

    test(
      "search prs in a public repo",
      async () => {
        const result = await gh("search", {
          query: "fix",
          type: "prs",
          repo: "cli/cli",
          limit: 3,
        });

        if (!result.success) throw new Error(`search prs failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThan(0);
      },
      TIMEOUT
    );

    test(
      "search code in a public repo",
      async () => {
        const result = await gh("search", {
          query: "fmt.Println",
          type: "code",
          repo: "cli/cli",
          limit: 3,
        });

        if (!result.success) throw new Error(`search code failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].path).toBeDefined();
        expect(data[0].repository).toBeDefined();
      },
      TIMEOUT
    );

    test(
      "search issues in a public repo",
      async () => {
        const result = await gh("search", {
          query: "bug",
          type: "issues",
          repo: "cli/cli",
          limit: 3,
        });

        if (!result.success) throw new Error(`search issues failed: ${result.error}`);
        const data = result.data as any[];
        expect(data).toBeInstanceOf(Array);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].number).toBeDefined();
        expect(data[0].title).toBeDefined();
      },
      TIMEOUT
    );
  });
});
