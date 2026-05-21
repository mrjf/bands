/**
 * CLI-based agent test helpers for banded skills.
 *
 * Runs Claude Code CLI in non-interactive mode with a skill's SKILL.md
 * as the system prompt, restricted to Bash(./scripts/*). Parses
 * stream-json output to verify which scripts were called and that
 * they succeeded.
 *
 * ALL tests require a running Lima VM. If Lima is not available,
 * tests error immediately — no false positives.
 */

import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { bandExec } from "../packages/runtime/src/banded-skills/exec";
import { acquireExecLockSync } from "../packages/runtime/src/banded-skills/lima-exec";

// Load .env from repo root and packages/runtime (both, not just first found)
const ENV_PATHS = [
  join(import.meta.dir, "..", ".env"),
  join(import.meta.dir, "..", "packages", "runtime", ".env"),
];
for (const p of ENV_PATHS) {
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
  }
}

export const AGENT_TIMEOUT = 120_000;

/**
 * Check that Claude Code CLI is installed and available.
 * Throws if not — agent tests cannot run without it.
 */
export function requireClaude() {
  try {
    execSync("claude --version", { stdio: "pipe" });
  } catch {
    throw new Error(
      "Claude Code CLI not found in PATH. Install it with: npm install -g @anthropic-ai/claude-code"
    );
  }
}

/**
 * Check that Lima VM is running and the band server is reachable.
 * Throws if not — tests must not pass without real execution.
 */
export function requireLima() {
  try {
    execSync("limactl --version", { stdio: "pipe" });
  } catch {
    throw new Error("limactl not installed. Lima VM is required for agent tests.");
  }

  try {
    const result = execSync("limactl list --json", { stdio: "pipe" }).toString();
    const parsed = JSON.parse(result);
    const vms = Array.isArray(parsed) ? parsed : [parsed];
    const vm = vms.find((v: any) => v.name === "bands-executor");
    if (!vm || vm.status !== "Running") {
      throw new Error(
        "Lima VM 'bands-executor' is not running. Start it with: limactl start bands-executor"
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("bands-executor")) throw e;
    throw new Error("Failed to check Lima VM status. Is limactl installed?");
  }

  let releaseLock: (() => void) | undefined;
  try {
    releaseLock = acquireExecLockSync();
    const resp = execSync("curl -sf --max-time 2 http://localhost:9000/health", {
      stdio: "pipe",
    });
  } catch {
    throw new Error(
      "Band server not reachable at localhost:9000. Is the band server running in the Lima VM?"
    );
  } finally {
    releaseLock?.();
  }
}

export interface ToolCall {
  command: string;
  output: string;
  exitCode: number | null;
}

export interface CLIAgentResult {
  toolCalls: ToolCall[];
  resultText: string;
  rawEvents: string[];
  exitCode: number;
}

/**
 * Run Claude Code CLI with a skill and capture tool calls + results.
 */
export async function runSkillAgent(
  skillDir: string,
  prompt: string,
  opts: {
    env?: Record<string, string>;
    maxBudget?: number;
    model?: string;
  } = {}
): Promise<CLIAgentResult> {
  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found at ${skillMdPath}`);
  }
  const skillMd = readFileSync(skillMdPath, "utf-8");

  const proc = Bun.spawn(
    [
      "claude",
      "--bare",
      "--print",
      "--verbose",
      "--output-format", "stream-json",
      "--no-session-persistence",
      "--max-budget-usd", String(opts.maxBudget ?? 1.0),
      "--dangerously-skip-permissions",
      "--model", opts.model ?? "sonnet",
      "--allowedTools", "Bash(./scripts/*)",
      "--system-prompt", skillMd,
      prompt,
    ],
    {
      cwd: skillDir,
      env: { ...process.env, ...opts.env },
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    // Extract the actual error from the assistant message or result event
    let errorDetail = "";
    for (const line of stdout.split("\n")) {
      try {
        const e = JSON.parse(line);
        if (e.type === "assistant" && e.message?.content) {
          for (const block of e.message.content) {
            if (block.type === "text" && block.text) {
              errorDetail += block.text;
            }
          }
        }
        if (e.type === "result" && e.result) {
          errorDetail += e.result;
        }
      } catch {}
    }
    throw new Error(
      `claude CLI exited ${exitCode}\n` +
      (errorDetail ? `Claude said: ${errorDetail.slice(0, 500)}\n` : "") +
      (stderr ? `stderr: ${stderr}\n` : "")
    );
  }

  const toolCalls: ToolCall[] = [];
  let resultText = "";
  const rawEvents: string[] = [];

  // Pending tool_use calls waiting for their tool_result
  const pendingCalls = new Map<string, { command: string }>();

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    rawEvents.push(line);

    // assistant events contain tool_use blocks
    if (event.type === "assistant" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "tool_use" && block.name === "Bash" && block.input?.command) {
          pendingCalls.set(block.id, { command: block.input.command });
        }
      }
    }

    // user events contain tool_result blocks (responses to tool calls)
    if (event.type === "user" && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (block.type === "tool_result" && pendingCalls.has(block.tool_use_id)) {
          const pending = pendingCalls.get(block.tool_use_id)!;
          pendingCalls.delete(block.tool_use_id);
          const output = typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content);
          toolCalls.push({
            command: pending.command,
            output,
            exitCode: block.is_error ? 1 : 0,
          });
        }
      }
    }

    // result event has the final text (and sometimes the full conversation)
    if (event.type === "result") {
      resultText = event.result || "";

      // Some versions include messages in the result — parse those too
      if (event.messages && toolCalls.length === 0) {
        const messages = event.messages as any[];
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "tool_use" && block.name === "Bash" && block.input?.command) {
                pendingCalls.set(block.id, { command: block.input.command });
              }
            }
          }
          if (msg.role === "user" && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "tool_result" && pendingCalls.has(block.tool_use_id)) {
                const pending = pendingCalls.get(block.tool_use_id)!;
                pendingCalls.delete(block.tool_use_id);
                const output = typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content);
                toolCalls.push({
                  command: pending.command,
                  output,
                  exitCode: block.is_error ? 1 : 0,
                });
              }
            }
          }
        }
      }
    }
  }

  // Any pending calls that never got a result
  for (const [, pending] of pendingCalls) {
    toolCalls.push({ command: pending.command, output: "", exitCode: null });
  }

  if (process.env.DEBUG_AGENT) {
    console.log("\n=== USER PROMPT ===");
    console.log(prompt);
    console.log("\n=== TOOL CALLS ===");
    for (const tc of toolCalls) {
      console.log(`  $ ${tc.command}`);
      console.log(`    exit: ${tc.exitCode}`);
      console.log(`    output: ${tc.output.slice(0, 200)}`);
    }
    console.log("\n=== RESULT TEXT ===");
    console.log(resultText.slice(0, 500));
  }

  return { toolCalls, resultText, rawEvents, exitCode };
}

/**
 * Find a tool call for a specific script. Returns the call or throws.
 */
export function getScriptCall(result: CLIAgentResult, scriptName: string): ToolCall {
  const call = result.toolCalls.find((tc) => tc.command.includes(`scripts/${scriptName}`));
  if (!call) {
    const allEvents = result.rawEvents.join("\n");
    const inEvents = allEvents.includes(`scripts/${scriptName}`);
    if (inEvents) {
      throw new Error(
        `scripts/${scriptName} appears in events but wasn't parsed as a tool call. ` +
        `This is a test infrastructure bug.`
      );
    }
    throw new Error(
      `Claude did not call scripts/${scriptName}.\n` +
      `Tool calls made: ${result.toolCalls.map((tc) => tc.command).join(", ") || "(none)"}\n` +
      `Result text: ${result.resultText.slice(0, 300)}`
    );
  }
  return call;
}

/**
 * Assert a script was called AND succeeded (exit code 0).
 */
export function expectScriptSucceeded(result: CLIAgentResult, scriptName: string): ToolCall {
  const call = getScriptCall(result, scriptName);
  if (call.exitCode !== 0) {
    throw new Error(
      `scripts/${scriptName} was called but failed (exit ${call.exitCode}).\n` +
      `Command: ${call.command}\n` +
      `Output: ${call.output.slice(0, 500)}`
    );
  }
  return call;
}

/**
 * Execute a skill script directly (for setup/teardown, not agent testing).
 */
export async function execScript(
  skillDir: string,
  script: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const resourcesDir = join(skillDir, "scripts", "resources");
  const tempDir = mkdtempSync(join(tmpdir(), "cli-agent-test-"));
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

/**
 * Create a skill-specific agent test harness.
 *
 * envMap: maps env var names the skill needs → env var names to read from process.env.
 * e.g. { GITHUB_TOKEN: "TEST_GITHUB_TOKEN" } means the skill gets GITHUB_TOKEN
 * sourced from process.env.TEST_GITHUB_TOKEN at call time.
 */
export function createSkillHarness(
  skillDir: string,
  envMap: Record<string, string>
) {
  function getEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    const missing: string[] = [];
    for (const [skillVar, sourceVar] of Object.entries(envMap)) {
      const val = process.env[sourceVar];
      if (!val) {
        missing.push(sourceVar);
      } else {
        env[skillVar] = val;
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required env vars: ${missing.join(", ")}\n` +
        `Set them in .env or environment: ${missing.map((k) => `export ${k}=<value>`).join("  ")}`
      );
    }
    return env;
  }

  return {
    agentCall(prompt: string): Promise<CLIAgentResult> {
      return runSkillAgent(skillDir, prompt, { env: getEnv() });
    },

    exec(script: string, input: Record<string, unknown>) {
      const env = getEnv();
      for (const [k, v] of Object.entries(env)) {
        process.env[k] = v;
      }
      return execScript(skillDir, script, input);
    },
  };
}
