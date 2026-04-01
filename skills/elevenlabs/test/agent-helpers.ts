/**
 * ElevenLabs-specific agent test helpers.
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
  requiredEnv: ["TEST_ELEVEN_LABS_TOKEN"],
  envToSet: { ELEVENLABS_API_KEY: process.env.TEST_ELEVEN_LABS_TOKEN! },
});

_harness = await harnessPromise;

/** Send a prompt to Claude, get back tool selection + execution result */
export const agentCall = _harness.agentCall;

/** Execute a script directly (same as direct tests) */
export const el = _harness.execScript;
