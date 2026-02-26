/**
 * Execute skill scripts in a sandboxed environment
 */

import type { LoadedSkill, SkillScript, SkillExecutionResult, SkillContext } from "./types";

/**
 * Execute a skill's scripts with the given context.
 *
 * Scripts are executed in order based on naming convention:
 * 1. main.* scripts run first
 * 2. run.* scripts run if no main.* exists
 * 3. Other scripts are available but not auto-executed
 */
export async function executeSkill(
  skill: LoadedSkill,
  context: SkillContext
): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const scriptsRun: string[] = [];
  let output = "";
  let error: string | undefined;

  try {
    // Find the entry point script
    const entryScript = findEntryScript(skill.scripts);

    if (!entryScript) {
      return {
        success: true,
        output: "No executable scripts found in skill",
        scripts_run: [],
        duration_ms: Date.now() - startTime,
      };
    }

    // Execute the script based on its language
    const result = await executeScript(entryScript, context, skill);
    scriptsRun.push(entryScript.filename);
    output = result.output;

    if (!result.success) {
      error = result.error;
    }

    return {
      success: result.success,
      output,
      error,
      scripts_run: scriptsRun,
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      output,
      error: err instanceof Error ? err.message : String(err),
      scripts_run: scriptsRun,
      duration_ms: Date.now() - startTime,
    };
  }
}

/**
 * Find the entry point script based on naming conventions.
 */
function findEntryScript(scripts: Map<string, SkillScript>): SkillScript | null {
  // Priority order for entry scripts
  const priorities = [
    "main.py",
    "main.sh",
    "main.js",
    "main.ts",
    "run.py",
    "run.sh",
    "run.js",
    "run.ts",
  ];

  for (const filename of priorities) {
    const script = scripts.get(filename);
    if (script) return script;
  }

  // Fall back to first script found
  const first = scripts.values().next();
  return first.done ? null : first.value;
}

/**
 * Execute a single script in the appropriate runtime.
 */
async function executeScript(
  script: SkillScript,
  context: SkillContext,
  skill: LoadedSkill
): Promise<{ success: boolean; output: string; error?: string }> {
  switch (script.language) {
    case "python":
      return executePython(script, context, skill);
    case "bash":
      return executeBash(script, context, skill);
    case "javascript":
    case "typescript":
      return executeJavaScript(script, context, skill);
    default:
      return {
        success: false,
        output: "",
        error: `Unsupported script language: ${script.language}`,
      };
  }
}

/**
 * Execute a Python script using subprocess.
 */
async function executePython(
  script: SkillScript,
  context: SkillContext,
  skill: LoadedSkill
): Promise<{ success: boolean; output: string; error?: string }> {
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");

  // Create temp directory for script execution
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"));
  const scriptPath = path.join(tmpDir, script.filename);

  try {
    // Write script to temp file
    fs.writeFileSync(scriptPath, script.content);

    // Write any additional scripts that might be imported
    for (const [filename, s] of skill.scripts) {
      if (filename !== script.filename) {
        fs.writeFileSync(path.join(tmpDir, filename), s.content);
      }
    }

    // Prepare environment
    const env: Record<string, string> = {
      ...process.env,
      ...context.env,
      SKILL_REQUEST: context.request,
      SKILL_WORKDIR: context.workdir,
    };

    // Execute Python
    const proc = Bun.spawn(["python3", scriptPath], {
      cwd: context.workdir,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    await proc.exited;

    if (proc.exitCode !== 0) {
      return {
        success: false,
        output: stdout,
        error: stderr || `Process exited with code ${proc.exitCode}`,
      };
    }

    return { success: true, output: stdout };
  } finally {
    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Execute a Bash script using subprocess.
 */
async function executeBash(
  script: SkillScript,
  context: SkillContext,
  skill: LoadedSkill
): Promise<{ success: boolean; output: string; error?: string }> {
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");

  // Create temp directory for script execution
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"));
  const scriptPath = path.join(tmpDir, script.filename);

  try {
    // Write script to temp file
    fs.writeFileSync(scriptPath, script.content, { mode: 0o755 });

    // Prepare environment
    const env: Record<string, string> = {
      ...process.env,
      ...context.env,
      SKILL_REQUEST: context.request,
      SKILL_WORKDIR: context.workdir,
    };

    // Execute Bash
    const proc = Bun.spawn(["bash", scriptPath], {
      cwd: context.workdir,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    await proc.exited;

    if (proc.exitCode !== 0) {
      return {
        success: false,
        output: stdout,
        error: stderr || `Process exited with code ${proc.exitCode}`,
      };
    }

    return { success: true, output: stdout };
  } finally {
    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Execute a JavaScript/TypeScript script using Bun.
 */
async function executeJavaScript(
  script: SkillScript,
  context: SkillContext,
  skill: LoadedSkill
): Promise<{ success: boolean; output: string; error?: string }> {
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");

  // Create temp directory for script execution
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"));
  const scriptPath = path.join(tmpDir, script.filename);

  try {
    // Write script to temp file
    fs.writeFileSync(scriptPath, script.content);

    // Write any additional scripts
    for (const [filename, s] of skill.scripts) {
      if (filename !== script.filename) {
        fs.writeFileSync(path.join(tmpDir, filename), s.content);
      }
    }

    // Prepare environment
    const env: Record<string, string> = {
      ...process.env,
      ...context.env,
      SKILL_REQUEST: context.request,
      SKILL_WORKDIR: context.workdir,
    };

    // Execute with Bun
    const proc = Bun.spawn(["bun", "run", scriptPath], {
      cwd: context.workdir,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    await proc.exited;

    if (proc.exitCode !== 0) {
      return {
        success: false,
        output: stdout,
        error: stderr || `Process exited with code ${proc.exitCode}`,
      };
    }

    return { success: true, output: stdout };
  } finally {
    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Create a restricted execution context for a skill.
 */
export function createSkillContext(
  request: string,
  restrictedFetch: typeof fetch,
  env: Record<string, string> = {},
  workdir?: string
): SkillContext {
  return {
    request,
    fetch: restrictedFetch,
    env,
    workdir: workdir || process.cwd(),
  };
}
