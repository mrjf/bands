/**
 * GitHub Skill — Gist operations
 *
 * Uses TEST_GIST_GITHUB_TOKEN (classic PAT with gist scope).
 * Fine-grained tokens cannot access the gists API.
 */

import { describe, expect, test } from "bun:test";
import { join, resolve } from "path";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";

// ── Load .env (same as github-helpers) ────────────────────────────────
import { readFileSync } from "fs";

function loadEnv() {
  const possiblePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "packages", "runtime", ".env"),
    resolve(__dirname, "..", "..", "..", "packages", "runtime", ".env"),
    resolve(__dirname, "..", "..", "..", ".env"),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      for (const line of readFileSync(p, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const key = trimmed.slice(0, eq);
            const val = trimmed.slice(eq + 1);
            if (!process.env[key]) process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────

const GIST_TOKEN = process.env.TEST_GIST_GITHUB_TOKEN;

if (!GIST_TOKEN) {
  throw new Error("Missing required env var: TEST_GIST_GITHUB_TOKEN");
}

process.env.GITHUB_TOKEN = GIST_TOKEN;

const SKILL_ROOT = resolve(__dirname, "..");
const RESOURCES = join(SKILL_ROOT, "scripts", "resources");
const TIMEOUT = 60_000;

async function gh(script: string, input: Record<string, unknown>) {
  const tempDir = mkdtempSync(join(tmpdir(), "gh-test-"));
  const inputPath = join(tempDir, "input.json");
  writeFileSync(inputPath, JSON.stringify(input));

  try {
    return await bandExec({
      resourceDir: join(RESOURCES, script),
      args: {},
      inputPath,
      skillRoot: SKILL_ROOT,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("github skill: gists", () => {
  let gistId: string;

  test(
    "create a secret gist",
    async () => {
      const result = await gh("gist-create", {
        filename: "test.ts",
        content: `console.log("hello");\n`,
        description: `Test gist ${Date.now()}`,
        public: false,
      });

      if (!result.success) {
        throw new Error(`gist-create failed: ${result.error}`);
      }
      const data = result.data as any;
      gistId = data.id;
      expect(typeof gistId).toBe("string");
      expect(gistId.length).toBeGreaterThan(0);
      expect(data.url).toContain("gist.github.com");
      expect(data.url).toContain(gistId);

      // Verify file content via gist-view
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(true);
      const gist = verify.data as any;
      expect(gist.public).toBe(false);
      expect(gist.files).toBeInstanceOf(Array);
      expect(gist.files.length).toBe(1);
      expect(gist.files[0].filename).toBe("test.ts");
      expect(gist.files[0].language).toBe("TypeScript");
      expect(gist.files[0].size).toBeGreaterThan(0);

      // Verify raw content via API
      const raw = await gh("api", { endpoint: `gists/${gistId}`, method: "GET" });
      expect(raw.success).toBe(true);
      const rawFiles = (raw.data as any).files;
      expect(rawFiles["test.ts"]).toBeDefined();
      expect(rawFiles["test.ts"].content).toContain('console.log("hello")');
    },
    TIMEOUT
  );

  test(
    "list gists includes the created gist",
    async () => {
      expect(gistId, "gist-create must succeed first").toBeTruthy();

      const result = await gh("gist-list", { limit: 10 });
      expect(result.success).toBe(true);
      const data = result.data as any[];
      expect(data).toBeInstanceOf(Array);

      const found = data.find((g: any) => g.id === gistId);
      expect(found).toBeDefined();
      expect(found.public).toBe(false);
      expect(found.url).toContain("gist.github.com");
      expect(found.files).toBeInstanceOf(Array);
      expect(found.files.length).toBe(1);
      expect(found.files[0]).toBe("test.ts");

      // Every item has expected shape
      for (const item of data) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.public).toBe("boolean");
        expect(item.url).toContain("gist.github.com");
        expect(item.files).toBeInstanceOf(Array);
        expect(item.files.length).toBeGreaterThan(0);
      }
    },
    TIMEOUT
  );

  test(
    "view the gist",
    async () => {
      expect(gistId, "gist-create must succeed first").toBeTruthy();

      const result = await gh("gist-view", { id: gistId });
      if (!result.success) {
        throw new Error(`gist-view failed: ${result.error}`);
      }
      const data = result.data as any;
      expect(data.id).toBe(gistId);
      expect(data.public).toBe(false);
      expect(data.description).toContain("Test gist");
      expect(data.url).toContain("gist.github.com");
      expect(data.owner).toBeDefined();
      expect(typeof data.owner.login).toBe("string");
      expect(data.createdAt).toBeTruthy();
      expect(data.updatedAt).toBeTruthy();
      expect(data.files).toBeInstanceOf(Array);
      expect(data.files.length).toBe(1);
      expect(data.files[0].filename).toBe("test.ts");
      expect(data.files[0].language).toBe("TypeScript");
      expect(data.files[0].size).toBeGreaterThan(0);
    },
    TIMEOUT
  );

  test(
    "delete the gist",
    async () => {
      expect(gistId, "gist-create must succeed first").toBeTruthy();

      const result = await gh("gist-delete", { id: gistId });
      if (!result.success) {
        throw new Error(`gist-delete failed: ${result.error}`);
      }
      const data = result.data as any;
      expect(data.deleted).toBe(true);
      expect(data.id).toBe(gistId);

      // Verify the gist is actually gone
      const verify = await gh("gist-view", { id: gistId });
      expect(verify.success).toBe(false);
    },
    TIMEOUT
  );
});
