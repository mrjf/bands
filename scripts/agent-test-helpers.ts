/**
 * Generic agent test helpers for banded skills.
 *
 * Any skill with scripts/resources/ and a SKILL.md can use these helpers
 * to verify that Claude correctly discovers and uses each script given
 * natural language prompts.
 *
 * Usage in a skill's test file:
 *
 *   import { createAgentHarness } from "../../../scripts/agent-test-helpers";
 *   const { agentCall, execScript } = await createAgentHarness({
 *     skillDir: resolve(__dirname, ".."),
 *     requiredEnv: ["GITHUB_TEST_TOKEN"],
 *     envToSet: { GITHUB_TOKEN: process.env.GITHUB_TEST_TOKEN! },
 *   });
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import Anthropic from "@anthropic-ai/sdk";
import { bandExec } from "../packages/runtime/src/banded-skills/exec";

// ── Config ──────────────────────────────────────────────────────────────

export const AGENT_TIMEOUT = 60_000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// ── .env loading ────────────────────────────────────────────────────────

function loadEnv() {
  const possiblePaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "packages", "runtime", ".env"),
    resolve(__dirname, "..", "packages", "runtime", ".env"),
    resolve(__dirname, "..", ".env"),
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

// ── Tool loading ────────────────────────────────────────────────────────

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Parse SKILL.md bullet points to extract script descriptions.
 * Format: `- \`name\` — description`
 */
function parseSkillDescriptions(skillMdPath: string): Record<string, string> {
  const content = readFileSync(skillMdPath, "utf-8");
  const descriptions: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const match = line.match(/^- `([^`]+)` — (.+)$/);
    if (match) {
      descriptions[match[1]] = match[2].trim();
    }
  }

  return descriptions;
}

/**
 * Load tool definitions from a skill's script resources and SKILL.md.
 */
function loadToolDefinitions(skillDir: string): ToolDefinition[] {
  const skillMdPath = join(skillDir, "SKILL.md");
  const resourcesDir = join(skillDir, "scripts", "resources");
  const descriptions = parseSkillDescriptions(skillMdPath);
  const tools: ToolDefinition[] = [];

  if (!existsSync(resourcesDir)) return tools;

  const scriptDirs = readdirSync(resourcesDir).filter((d) =>
    existsSync(join(resourcesDir, d, "input_schema.json"))
  );

  for (const dir of scriptDirs) {
    const schemaPath = join(resourcesDir, dir, "input_schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    tools.push({
      name: dir,
      description: descriptions[dir] || dir,
      input_schema: schema,
    });
  }

  return tools;
}

// ── Types ───────────────────────────────────────────────────────────────

export interface AgentCallResult {
  toolName: string;
  toolInput: Record<string, unknown>;
  execResult: { success: boolean; data?: unknown; error?: string };
  usage: { input_tokens: number; output_tokens: number };
}

export interface AgentHarnessOptions {
  /** Absolute path to the skill directory (contains SKILL.md, scripts/) */
  skillDir: string;
  /** Env vars that must be set (throws at init if missing) */
  requiredEnv?: string[];
  /** Env vars to inject into process.env (e.g. { GITHUB_TOKEN: process.env.GITHUB_TEST_TOKEN }) */
  envToSet?: Record<string, string>;
  /** Extra system prompt lines appended after the SKILL.md content */
  systemPromptSuffix?: string;
}

export interface AgentHarness {
  /** Send a prompt to Claude, get back tool selection + execution result */
  agentCall: (prompt: string) => Promise<AgentCallResult>;
  /** Execute a script directly (for setup/teardown/verification) */
  execScript: (script: string, input: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  /** The loaded tool definitions */
  tools: ToolDefinition[];
  /** Absolute path to skill root */
  skillDir: string;
  /** Absolute path to resources dir */
  resourcesDir: string;
}

// ── Harness factory ─────────────────────────────────────────────────────

/**
 * Create an agent test harness for a specific skill.
 * Validates env vars + API key at creation time (fails fast).
 */
export async function createAgentHarness(opts: AgentHarnessOptions): Promise<AgentHarness> {
  const { skillDir, requiredEnv = [], envToSet = {} } = opts;

  // Check required env vars
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
  for (const key of requiredEnv) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  // Inject env vars
  for (const [key, val] of Object.entries(envToSet)) {
    if (val) process.env[key] = val;
  }

  // Validate skill structure
  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found at ${skillMdPath}`);
  }

  const resourcesDir = join(skillDir, "scripts", "resources");
  if (!existsSync(resourcesDir)) {
    throw new Error(`scripts/resources/ not found at ${resourcesDir}`);
  }

  // Load tools
  const tools = loadToolDefinitions(skillDir);
  if (tools.length === 0) {
    throw new Error(`No scripts with input_schema.json found in ${resourcesDir}`);
  }

  // Build system prompt
  const skillMd = readFileSync(skillMdPath, "utf-8");
  const systemPrompt = [
    skillMd,
    "",
    "You are an assistant that performs operations using the available tools.",
    "Always use the most appropriate tool with correct parameters.",
    "Never respond with text only — always use a tool.",
    opts.systemPromptSuffix || "",
  ].join("\n");

  // Validate API key
  const client = new Anthropic();
  try {
    await client.messages.create({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    });
  } catch (e: any) {
    if (e?.status === 401) {
      throw new Error("ANTHROPIC_API_KEY is invalid (401 authentication error)");
    }
    if (e?.status === 404) {
      throw new Error(`Model not found: ${MODEL}. Set ANTHROPIC_MODEL to override.`);
    }
    throw e;
  }

  // Script executor
  async function execScript(script: string, input: Record<string, unknown>) {
    const tempDir = mkdtempSync(join(tmpdir(), "agent-test-"));
    const inputPath = join(tempDir, "input.json");
    writeFileSync(inputPath, JSON.stringify(input));

    try {
      const result = await bandExec({
        resourceDir: join(resourcesDir, script),
        args: {},
        inputPath,
        skillRoot: skillDir,
      });
      return { success: result.success, data: result.data, error: result.error };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // Agent caller
  async function agentCall(prompt: string): Promise<AgentCallResult> {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ContentBlock & { type: "tool_use" } =>
        block.type === "tool_use"
    );

    if (!toolUse) {
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      throw new Error(
        `Agent did not use a tool. Response: ${textContent.slice(0, 200)}`
      );
    }

    const toolInput = toolUse.input as Record<string, unknown>;
    const execResult = await execScript(toolUse.name, toolInput);

    if (!execResult.success) {
      throw new Error(
        `Script '${toolUse.name}' execution failed: ${execResult.error || "unknown error"}\n` +
        `Input: ${JSON.stringify(toolInput)}`
      );
    }

    return {
      toolName: toolUse.name,
      toolInput,
      execResult,
      usage: response.usage,
    };
  }

  return { agentCall, execScript, tools, skillDir, resourcesDir };
}
