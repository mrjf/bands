#!/usr/bin/env bun
/**
 * Locked-down `band` CLI for agent sessions.
 *
 * Security model:
 * - Only runs registered scripts from known skills — no arbitrary paths
 * - Auto-discovers scripts: `band gist-list --limit=5`
 * - Always uses Lima VM for execution
 * - No subcommands, no exec, no path arguments
 *
 * Usage:
 *   band <script-name> [--key=value ...]
 *   band --list
 *   band <script-name> --help
 */

import { readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { bandExec } from "./banded-skills/exec";

export interface DiscoveredScript {
  resourceDir: string;
  skillRoot: string;
  skillName: string;
}

/**
 * Discover all scripts across all skills in the skills directory.
 *
 * Scans: <skillsDir>/<skill>/scripts/resources/<script>/run.sh
 */
export function discoverScripts(
  skillsDir: string
): Map<string, DiscoveredScript> {
  const scripts = new Map<string, DiscoveredScript>();

  if (!existsSync(skillsDir)) {
    return scripts;
  }

  let skillDirs: string[];
  try {
    skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink())
      .map((d) => d.name);
  } catch {
    return scripts;
  }

  for (const skillName of skillDirs) {
    const skillRoot = join(skillsDir, skillName);
    const resourcesDir = join(skillRoot, "scripts", "resources");

    if (!existsSync(resourcesDir)) {
      continue;
    }

    let scriptDirs: string[];
    try {
      scriptDirs = readdirSync(resourcesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() || d.isSymbolicLink())
        .map((d) => d.name);
    } catch {
      continue;
    }

    for (const scriptName of scriptDirs) {
      const resourceDir = join(resourcesDir, scriptName);
      const runShPath = join(resourceDir, "run.sh");

      if (!existsSync(runShPath)) {
        continue;
      }

      if (scripts.has(scriptName)) {
        // Ambiguous — same script name in multiple skills
        const existing = scripts.get(scriptName)!;
        console.error(
          `Error: Ambiguous script name "${scriptName}" found in both "${existing.skillName}" and "${skillName}".`
        );
        console.error(
          `Script names must be unique across all skills.`
        );
        process.exit(1);
      }

      scripts.set(scriptName, {
        resourceDir,
        skillRoot,
        skillName,
      });
    }
  }

  return scripts;
}

export interface ParsedArgs {
  scriptName: string;
  args: Record<string, string>;
  help: boolean;
  list: boolean;
}

/**
 * Parse CLI arguments.
 *
 * First non-flag argument is the script name. Everything else is --key=value.
 */
export function parseBandRunArgs(argv: string[]): ParsedArgs {
  const args: Record<string, string> = {};
  let scriptName = "";
  let help = false;
  let list = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--list") {
      list = true;
      i++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      let key: string;
      let value: string;

      if (eqIdx !== -1) {
        key = arg.slice(2, eqIdx);
        value = arg.slice(eqIdx + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        key = arg.slice(2);
        value = argv[i + 1];
        i++;
      } else {
        key = arg.slice(2);
        value = "true";
      }

      args[key] = value;
    } else if (!scriptName) {
      scriptName = arg;
    }

    i++;
  }

  return { scriptName, args, help, list };
}

/**
 * Format the --list output showing all available scripts grouped by skill.
 */
export function formatScriptList(
  scripts: Map<string, DiscoveredScript>
): string {
  if (scripts.size === 0) {
    return "No scripts found.";
  }

  // Group by skill
  const bySkill = new Map<string, string[]>();
  for (const [name, info] of scripts) {
    const existing = bySkill.get(info.skillName) || [];
    existing.push(name);
    bySkill.set(info.skillName, existing);
  }

  const lines: string[] = ["Available scripts:", ""];
  for (const [skill, names] of bySkill) {
    lines.push(`  ${skill}:`);
    for (const name of names.sort()) {
      lines.push(`    ${name}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- Main ---

async function main() {
  const skillsDir =
    process.env.BAND_SKILLS_DIR || join(homedir(), ".claude", "skills");

  const scripts = discoverScripts(skillsDir);
  const parsed = parseBandRunArgs(process.argv.slice(2));

  // --list: print all available scripts
  if (parsed.list) {
    console.log(formatScriptList(scripts));
    return;
  }

  // No script name provided
  if (!parsed.scriptName) {
    if (parsed.help) {
      console.log("Usage: band <script-name> [--key=value ...]");
      console.log("       band --list");
      console.log("       band <script-name> --help");
      return;
    }
    console.error("Error: Script name required.");
    console.error("Usage: band <script-name> [--key=value ...]");
    console.error("Run `band --list` to see available scripts.");
    process.exit(1);
  }

  // Unknown script
  if (!scripts.has(parsed.scriptName)) {
    console.error(`Error: Unknown script "${parsed.scriptName}".`);
    console.error("Run `band --list` to see available scripts.");
    process.exit(1);
  }

  const { resourceDir, skillRoot } = scripts.get(parsed.scriptName)!;

  const result = await bandExec({
    resourceDir,
    args: parsed.args,
    help: parsed.help,
    skillRoot,
  });

  if (result.success) {
    if (parsed.help) {
      console.log(result.data);
    } else if (result.data !== undefined) {
      if (typeof result.data === "string") {
        console.log(result.data);
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }
    }
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

// Only run when executed directly, not when imported for testing
if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
