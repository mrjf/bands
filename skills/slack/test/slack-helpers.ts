/**
 * Shared helpers for Slack banded skill tests.
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

export const SLACK_BOT_TOKEN = process.env.TEST_SLACK_BOT_TOKEN;
export const SLACK_CHANNEL = process.env.TEST_SLACK_CHANNEL;

// Set SLACK_BOT_TOKEN so scripts pick it up
if (SLACK_BOT_TOKEN) {
  process.env.SLACK_BOT_TOKEN = SLACK_BOT_TOKEN;
}

// Resolve skill root
function findSkillRoot(): string {
  const candidates = [
    resolve(__dirname, ".."),
    resolve(process.cwd(), "skills", "slack"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "SKILL.md"))) return c;
  }
  throw new Error(`Cannot find skills/slack (searched: ${candidates.join(", ")})`);
}

export const SKILL_ROOT = findSkillRoot();
export const RESOURCES = join(SKILL_ROOT, "scripts", "resources");

export const TIMEOUT = 60_000;

/**
 * Require TEST_SLACK_BOT_TOKEN and TEST_SLACK_CHANNEL.
 * Call at the start of any test that talks to Slack.
 */
export function requireSlackEnv(): { token: string; channel: string } {
  const missing: string[] = [];
  if (!SLACK_BOT_TOKEN) missing.push("TEST_SLACK_BOT_TOKEN");
  if (!SLACK_CHANNEL) missing.push("TEST_SLACK_CHANNEL");
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return { token: SLACK_BOT_TOKEN!, channel: SLACK_CHANNEL! };
}

// ── Helper to exec a slack skill script with proper JSON input ────────

export async function slack(script: string, input: Record<string, unknown>) {
  requireSlackEnv();
  const tempDir = mkdtempSync(join(tmpdir(), "slack-test-"));
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

/**
 * Execute a script with custom band config (slack: section in BAND.md).
 * Temporarily overwrites BAND.md with the custom config, runs the script,
 * then restores the original.
 *
 * permsYaml is the slack config as a YAML string (e.g. "channels:\n  allow: []\ndm: false\n").
 * It gets embedded under the `slack:` key in BAND.md frontmatter.
 */
export async function slackWithPerms(
  script: string,
  input: Record<string, unknown>,
  permsYaml: string,
  token?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Save and set the token for the duration of this call.
  // Use the provided token, or the real one from TEST_SLACK_BOT_TOKEN, or a fake one.
  const origToken = process.env.SLACK_BOT_TOKEN;
  process.env.SLACK_BOT_TOKEN = token || SLACK_BOT_TOKEN || "xoxb-fake-token-for-testing";

  // Build a BAND.md with the custom slack config indented under "slack:"
  const indented = permsYaml
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : ""))
    .filter((_, i, arr) => i < arr.length - 1 || arr[i] !== "") // trim trailing empty
    .join("\n");

  const bandMdPath = join(SKILL_ROOT, "BAND.md");
  const origBandMd = readFileSync(bandMdPath, "utf-8");

  const newBandMd = `---
band: slack
icon: 💬
description: Slack operations via Web API with declarative channel permissions
allow:
  cli:
    - "curl *"
    - "jq *"
  net:
    - "slack.com"
env:
  secrets:
    - SLACK_BOT_TOKEN
    - SLACK_USER_TOKEN
requires:
  secrets:
    - SLACK_BOT_TOKEN
execution:
  target: local-dangerously
slack:
${indented}
---
`;

  writeFileSync(bandMdPath, newBandMd);

  const tempDir = mkdtempSync(join(tmpdir(), "slack-perm-test-"));
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
    // Restore original BAND.md and token
    writeFileSync(bandMdPath, origBandMd);
    // Always restore to the real token (from module load), not whatever
    // was in process.env at call time (which may have been clobbered)
    if (SLACK_BOT_TOKEN) {
      process.env.SLACK_BOT_TOKEN = SLACK_BOT_TOKEN;
    } else if (origToken) {
      process.env.SLACK_BOT_TOKEN = origToken;
    } else {
      delete process.env.SLACK_BOT_TOKEN;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}
