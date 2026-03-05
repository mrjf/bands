/**
 * Shared helpers for GitHub banded skill integration tests.
 *
 * Each test file imports from here to avoid duplication.
 */

import { join, resolve } from "path";
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";

// ── Load .env ──────────────────────────────────────────────────────────

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

// ── Config ─────────────────────────────────────────────────────────────

export const GITHUB_TOKEN = process.env.GITHUB_TEST_TOKEN;
export const GITHUB_REPO = process.env.GITHUB_TEST_REPO;

// Set GITHUB_TOKEN so gh CLI picks it up
if (GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = GITHUB_TOKEN;
}

// Resolve skill root — works whether cwd is repo root or packages/runtime
function findSkillRoot(): string {
  const candidates = [
    resolve(__dirname, ".."),                              // skills/github/test/../
    resolve(process.cwd(), "skills", "github"),            // from repo root
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "SKILL.md"))) return c;
  }
  throw new Error(`Cannot find skills/github (searched: ${candidates.join(", ")})`);
}

export const SKILL_ROOT = findSkillRoot();
export const RESOURCES = join(SKILL_ROOT, "scripts", "resources");

export const TIMEOUT = 30_000;

export const canRun = !!(GITHUB_TOKEN && GITHUB_REPO);

// ── Helper to exec a github skill script with proper JSON input ──────

export async function gh(script: string, input: Record<string, unknown>) {
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

// ── Ensure repo has at least one commit ──────────────────────────────

export async function ensureRepoInitialized(): Promise<boolean> {
  const [owner, repo] = GITHUB_REPO!.split("/");

  const check = await gh("api", {
    endpoint: `repos/${owner}/${repo}/git/ref/heads/main`,
    method: "GET",
  });

  if (check.success) return true;

  // Initialize repo with a README via the API
  const content = Buffer.from("# Test Repository\n\nUsed for bands integration tests.\n").toString("base64");
  const init = await gh("api", {
    endpoint: `repos/${owner}/${repo}/contents/README.md`,
    method: "PUT",
    body: { message: "Initial commit", content },
  });

  return init.success;
}

// ── Helper to create a branch with a file (needed for PR tests) ──────

export async function createBranchWithFile(branchName: string): Promise<string> {
  const [owner, repo] = GITHUB_REPO!.split("/");

  const refResult = await gh("api", {
    endpoint: `repos/${owner}/${repo}/git/ref/heads/main`,
    method: "GET",
  });
  if (!refResult.success) {
    throw new Error(`Failed to get main ref: ${refResult.error}`);
  }
  const baseSha = (refResult.data as any).object.sha;

  const branchResult = await gh("api", {
    endpoint: `repos/${owner}/${repo}/git/refs`,
    method: "POST",
    body: { ref: `refs/heads/${branchName}`, sha: baseSha },
  });
  if (!branchResult.success) {
    throw new Error(`Failed to create branch ${branchName}: ${branchResult.error}`);
  }

  const content = Buffer.from(`Test file for ${branchName} at ${new Date().toISOString()}\n`).toString("base64");
  const fileResult = await gh("api", {
    endpoint: `repos/${owner}/${repo}/contents/test-${branchName}-${Date.now()}.txt`,
    method: "PUT",
    body: { message: `test: add file for ${branchName}`, content, branch: branchName },
  });
  if (!fileResult.success) {
    throw new Error(`Failed to create file on branch ${branchName}: ${fileResult.error}`);
  }

  return baseSha;
}
