/**
 * Summarize-specific agent test helpers.
 */

import { resolve } from "path";
import { createAgentHarness, AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";
import type { AgentHarness } from "../../../scripts/agent-test-helpers";

export { AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";
export type { AgentCallResult } from "../../../scripts/agent-test-helpers";

const SKILL_DIR = resolve(__dirname, "..");

let _harness: AgentHarness;

const harnessPromise = createAgentHarness({
  skillDir: SKILL_DIR,
  requiredEnv: ["ANTHROPIC_API_KEY"],
});

_harness = await harnessPromise;

/** Send a prompt to Claude, get back tool selection + execution result */
export const agentCall = _harness.agentCall;
