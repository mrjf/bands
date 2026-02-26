/**
 * band-shell: A proxy shell that enforces CLI permission patterns.
 *
 * Commands are checked against allow/deny glob patterns from BAND.md.
 * A command is allowed if it matches at least one allow pattern
 * and matches zero deny patterns.
 *
 * Usage:
 *   band-shell --band ./BAND.md
 *   band-shell --allow "python *" --allow "cat *" --deny "rm *"
 *
 * The shell reads commands from stdin and executes allowed ones.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { checkCliPermission, parseBandMd } from "@bands/format";

export interface BandShellConfig {
  allow: string[];
  deny: string[];
  shell?: string;
  verbose?: boolean;
}

export interface CommandResult {
  allowed: boolean;
  code?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * Check if a command is allowed by the band's CLI permissions.
 */
export function isCommandAllowed(
  command: string,
  allow: string[],
  deny: string[]
): boolean {
  return checkCliPermission(command, allow, deny);
}

/**
 * Execute a command in the real shell.
 */
export async function executeCommand(
  command: string,
  shell: string = "/bin/sh"
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(shell, ["-c", command], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });

    proc.on("error", (err) => {
      stderr += err.message;
      resolve({ code: 1, stdout, stderr });
    });
  });
}

/**
 * Run a single command through the band-shell filter.
 */
export async function runCommand(
  command: string,
  config: BandShellConfig
): Promise<CommandResult> {
  const trimmed = command.trim();

  if (!trimmed) {
    return { allowed: true };
  }

  const allowed = isCommandAllowed(trimmed, config.allow, config.deny);

  if (!allowed) {
    const error = `band-shell: command denied: ${trimmed}`;
    if (config.verbose) {
      console.error(error);
    }
    return { allowed: false, error };
  }

  if (config.verbose) {
    console.error(`band-shell: executing: ${trimmed}`);
  }

  const result = await executeCommand(trimmed, config.shell);
  return {
    allowed: true,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Load CLI permissions from a BAND.md file.
 */
export async function loadBandConfig(
  bandPath: string
): Promise<{ allow: string[]; deny: string[] }> {
  const file = Bun.file(bandPath);
  const source = await file.text();
  const { document } = parseBandMd(source);

  // We still load the band even if there are validation warnings
  // (e.g., human-readable limits like "5m" instead of numbers)

  return {
    allow: document.allow?.cli ?? [],
    deny: document.deny?.cli ?? [],
  };
}

/**
 * Start an interactive band-shell session.
 */
export async function startInteractiveShell(
  config: BandShellConfig
): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "band$ ",
  });

  console.log("band-shell: Interactive mode");
  console.log(`  allow: ${config.allow.length} patterns`);
  console.log(`  deny: ${config.deny.length} patterns`);
  console.log('  Type "exit" to quit\n');

  rl.prompt();

  rl.on("line", async (line) => {
    const trimmed = line.trim();

    if (trimmed === "exit" || trimmed === "quit") {
      rl.close();
      return;
    }

    const result = await runCommand(trimmed, config);

    if (!result.allowed) {
      console.error(result.error);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nband-shell: Goodbye");
    process.exit(0);
  });
}

/**
 * Run band-shell as a script executor (non-interactive).
 * Reads commands from stdin, executes allowed ones.
 */
export async function runScriptMode(config: BandShellConfig): Promise<number> {
  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  let lastCode = 0;

  for await (const line of rl) {
    const result = await runCommand(line, config);

    if (!result.allowed) {
      console.error(result.error);
      return 126; // Command not allowed (similar to permission denied)
    }

    if (result.code !== undefined) {
      lastCode = result.code;
      if (lastCode !== 0) {
        return lastCode;
      }
    }
  }

  return lastCode;
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);
  const config: BandShellConfig = {
    allow: [],
    deny: [],
    verbose: false,
  };

  let bandPath: string | null = null;
  let command: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--band" || arg === "-b") {
      bandPath = args[++i];
    } else if (arg === "--allow" || arg === "-a") {
      config.allow.push(args[++i]);
    } else if (arg === "--deny" || arg === "-d") {
      config.deny.push(args[++i]);
    } else if (arg === "--verbose" || arg === "-v") {
      config.verbose = true;
    } else if (arg === "--shell" || arg === "-s") {
      config.shell = args[++i];
    } else if (arg === "-c") {
      command = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
band-shell: Proxy shell with glob-based command filtering

Usage:
  band-shell [options]              Interactive mode
  band-shell [options] -c "cmd"     Execute single command
  echo "cmd" | band-shell [options] Script mode (stdin)

Options:
  --band, -b <path>     Load allow/deny patterns from BAND.md
  --allow, -a <pattern> Add allow glob pattern (can repeat)
  --deny, -d <pattern>  Add deny glob pattern (can repeat)
  --shell, -s <path>    Shell to use (default: /bin/sh)
  --verbose, -v         Print debug info
  --help, -h            Show this help

Examples:
  band-shell --band ./BAND.md
  band-shell --allow "python *" --allow "pip *" --deny "rm *"
  band-shell -b ./BAND.md -c "python script.py"
`);
      process.exit(0);
    }
  }

  // Load band config if specified
  if (bandPath) {
    try {
      const bandConfig = await loadBandConfig(bandPath);
      config.allow = [...config.allow, ...bandConfig.allow];
      config.deny = [...config.deny, ...bandConfig.deny];
    } catch (err) {
      console.error(`band-shell: Failed to load ${bandPath}: ${err}`);
      process.exit(1);
    }
  }

  // Validate we have at least one allow pattern
  if (config.allow.length === 0) {
    console.error("band-shell: No allow patterns specified");
    console.error("Use --band <path> or --allow <pattern>");
    process.exit(1);
  }

  if (config.verbose) {
    console.error("band-shell: Configuration loaded");
    console.error(`  allow: ${JSON.stringify(config.allow)}`);
    console.error(`  deny: ${JSON.stringify(config.deny)}`);
  }

  // Execute mode
  if (command) {
    // Single command mode: -c "command"
    const result = await runCommand(command, config);
    if (!result.allowed) {
      console.error(result.error);
      process.exit(126);
    }
    process.exit(result.code ?? 0);
  } else if (!process.stdin.isTTY) {
    // Script mode: commands from stdin
    const code = await runScriptMode(config);
    process.exit(code);
  } else {
    // Interactive mode
    await startInteractiveShell(config);
  }
}
