/**
 * Banded skill generator.
 *
 * Generates banded skill structure components:
 * - Wrapper scripts (2-line bash stubs that call `band exec`)
 * - Sparse SKILL.md (listing available scripts)
 * - Per-script BAND.md (maximally restricted based on run.sh analysis)
 */

import type { BandDocument } from "@bands/format";

/**
 * Generate a wrapper script for a banded skill script.
 * The wrapper is a 2-line bash script that delegates to `band exec`.
 */
export function generateWrapper(scriptName: string): string {
  return `#!/bin/bash\nband exec scripts/resources/${scriptName} "$@"\n`;
}

/**
 * Generate a sparse SKILL.md that lists available scripts.
 */
export function generateSparseSKILLMd(
  name: string,
  description: string,
  scripts: string[]
): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`name: ${name}`);
  lines.push(`description: ${description}`);
  lines.push("---");
  lines.push("");

  // Body
  lines.push(`# ${name}`);
  lines.push("");
  lines.push(description);
  lines.push("");

  if (scripts.length > 0) {
    lines.push("## Available Scripts");
    lines.push("");
    for (const script of scripts) {
      lines.push(`- \`${script}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate a per-script BAND.md with maximally restricted permissions.
 *
 * Analyzes the run.sh content to determine minimal required permissions:
 * - CLI commands used
 * - File paths accessed
 * - Network hosts contacted
 */
export function generatePerScriptBand(
  scriptName: string,
  runShContent: string
): BandDocument {
  const cliPatterns = inferCliPatterns(runShContent);
  const readPatterns = inferReadPatterns(runShContent);
  const writePatterns = inferWritePatterns(runShContent);
  const netPatterns = inferNetPatterns(runShContent);

  const band: BandDocument = {
    band: scriptName,
    icon: "\u{1F4E6}",
    description: `Sandboxed execution environment for ${scriptName}`,
    execution: {
      target: "local-dangerously",
    },
  };

  // Build allow permissions
  const allow: BandDocument["allow"] = {};

  if (cliPatterns.length > 0) {
    allow.cli = cliPatterns;
  }
  if (readPatterns.length > 0) {
    allow.read = readPatterns;
  }
  if (writePatterns.length > 0) {
    allow.write = writePatterns;
  }
  if (netPatterns.length > 0) {
    allow.net = netPatterns;
  }

  if (Object.keys(allow).length > 0) {
    band.allow = allow;
  }

  return band;
}

/**
 * Infer CLI command patterns from run.sh content.
 */
function inferCliPatterns(content: string): string[] {
  const patterns = new Set<string>();

  // Common commands to look for
  const commands = [
    "cat",
    "echo",
    "grep",
    "sed",
    "awk",
    "sort",
    "uniq",
    "head",
    "tail",
    "wc",
    "tr",
    "cut",
    "jq",
    "curl",
    "wget",
    "python",
    "python3",
    "node",
    "npm",
    "npx",
    "bun",
    "bunx",
    "pip",
    "pip3",
    "git",
    "find",
    "ls",
    "mkdir",
    "cp",
    "mv",
    "rm",
    "chmod",
  ];

  for (const cmd of commands) {
    // Match command at line start, after pipe, after &&, after ||, after $(), after backtick
    const regex = new RegExp(
      `(?:^|\\||&&|\\|\\||\\$\\(|` + "`)" + `\\s*${cmd}\\b`,
      "m"
    );
    if (regex.test(content)) {
      patterns.add(`${cmd} *`);
    }
  }

  return [...patterns].sort();
}

/**
 * Infer file read patterns from run.sh content.
 */
function inferReadPatterns(content: string): string[] {
  const patterns = new Set<string>();

  // Look for cat, source, read operations on files
  if (/\$INPUT_PATH|\$\{INPUT_PATH/.test(content)) {
    patterns.add("$INPUT_PATH");
  }

  // Look for explicit file reads
  const fileReadRegex = /cat\s+["']?([^\s"'|>]+)/g;
  let match;
  while ((match = fileReadRegex.exec(content)) !== null) {
    const path = match[1];
    if (!path.startsWith("$") && !path.startsWith("-")) {
      patterns.add(path);
    }
  }

  return [...patterns];
}

/**
 * Infer file write patterns from run.sh content.
 */
function inferWritePatterns(content: string): string[] {
  const patterns = new Set<string>();

  if (/\$OUTPUT_PATH|\$\{OUTPUT_PATH/.test(content)) {
    patterns.add("$OUTPUT_PATH");
  }

  // Look for redirections to files
  const redirectRegex = />\s*["']?([^\s"'&|]+)/g;
  let match;
  while ((match = redirectRegex.exec(content)) !== null) {
    const path = match[1];
    if (
      !path.startsWith("$") &&
      !path.startsWith("-") &&
      !path.startsWith("/dev/")
    ) {
      patterns.add(path);
    }
  }

  return [...patterns];
}

/**
 * Infer network host patterns from run.sh content.
 */
function inferNetPatterns(content: string): string[] {
  const patterns = new Set<string>();

  // Look for curl/wget URLs
  const urlRegex =
    /(?:curl|wget)\s+.*?(?:https?:\/\/)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;
  while ((match = urlRegex.exec(content)) !== null) {
    patterns.add(match[1]);
  }

  return [...patterns].sort();
}
