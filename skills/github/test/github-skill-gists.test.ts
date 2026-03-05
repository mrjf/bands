/**
 * GitHub Skill — Gist operations
 *
 * Uses GITHUB_GIST_TEST_TOKEN (classic PAT with gist scope).
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

const GIST_TOKEN = process.env.GITHUB_GIST_TEST_TOKEN;

if (!GIST_TOKEN) {
  throw new Error("Missing required env var: GITHUB_GIST_TEST_TOKEN");
}

process.env.GITHUB_TOKEN = GIST_TOKEN;

const SKILL_ROOT = resolve(__dirname, "..");
const RESOURCES = join(SKILL_ROOT, "scripts", "resources");
const TIMEOUT = 30_000;

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
      expect(gistId).toBeTruthy();
      expect(data.url).toContain("gist.github.com");
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
      expect(data.files).toBeInstanceOf(Array);
      expect(data.files.length).toBeGreaterThanOrEqual(1);
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
      expect((result.data as any).deleted).toBe(true);
    },
    TIMEOUT
  );
});
