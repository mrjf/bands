/**
 * GitHub-specific agent test helpers.
 *
 * Thin wrapper around the generic agent-test-helpers, adding GitHub
 * env vars, token setup, and re-exporting github-helpers utilities.
 */

import { resolve } from "path";
import { createAgentHarness, AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";
import type { AgentHarness } from "../../../scripts/agent-test-helpers";

export { AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";
export type { AgentCallResult } from "../../../scripts/agent-test-helpers";

// Re-export github-specific helpers for setup/teardown
export { ensureRepoInitialized, createBranchWithFile } from "./github-helpers";

const SKILL_DIR = resolve(__dirname, "..");

export const GITHUB_TOKEN = process.env.TEST_GITHUB_TOKEN;
export const GITHUB_REPO = process.env.TEST_GITHUB_REPO;

let _harness: AgentHarness;

const harnessPromise = createAgentHarness({
  skillDir: SKILL_DIR,
  requiredEnv: ["TEST_GITHUB_TOKEN", "TEST_GITHUB_REPO"],
  envToSet: { GITHUB_TOKEN: process.env.TEST_GITHUB_TOKEN! },
  systemPromptSuffix: "If a repo is mentioned, pass it as the `repo` parameter.",
});

_harness = await harnessPromise;

/** Send a prompt to Claude, get back tool selection + execution result */
export const agentCall = _harness.agentCall;

/** Execute a github script directly (for setup/teardown/verification) */
export const gh = _harness.execScript;
