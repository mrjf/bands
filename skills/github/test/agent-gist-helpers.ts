/**
 * Gist-specific agent test helpers.
 *
 * Uses TEST_GIST_GITHUB_TOKEN (classic PAT with gist scope) instead of
 * TEST_GITHUB_TOKEN (fine-grained PAT that can't access gists).
 */

import { resolve } from "path";
import { createAgentHarness, AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";
import type { AgentHarness } from "../../../scripts/agent-test-helpers";

export { AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";
export type { AgentCallResult } from "../../../scripts/agent-test-helpers";

const SKILL_DIR = resolve(__dirname, "..");

export const GITHUB_GIST_TOKEN = process.env.TEST_GIST_GITHUB_TOKEN;

let _harness: AgentHarness;

const harnessPromise = createAgentHarness({
  skillDir: SKILL_DIR,
  requiredEnv: ["TEST_GIST_GITHUB_TOKEN"],
  envToSet: { GITHUB_TOKEN: process.env.TEST_GIST_GITHUB_TOKEN! },
  systemPromptSuffix: "You have access to gist operations. Use the appropriate gist tool.",
});

_harness = await harnessPromise;

/** Send a prompt to Claude, get back tool selection + execution result */
export const agentCall = _harness.agentCall;

/** Execute a github script directly (for setup/teardown/verification) */
export const gh = _harness.execScript;
