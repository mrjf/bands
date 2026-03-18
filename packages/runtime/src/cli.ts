#!/usr/bin/env bun
/**
 * CLI for Band runtime management.
 *
 * Usage:
 *   bun run src/cli.ts deploy <band.md> [--name <worker-name>]
 *   bun run src/cli.ts init <worker-url> <band.md>
 *   bun run src/cli.ts run <band.md> [--target <target>] [--input <json>]
 *   bun run src/cli.ts wrap-skill <skill-source> [--output <band.md>]
 *   bun run src/cli.ts targets
 */

import { readFileSync, writeFileSync } from "fs";
import { parseBandMd, exportBandMd, type ExecutionTarget } from "@bands/format";
import { compileBand } from "./loader";
import { fetchSkill, generateSkillBand, generateSkillSystemPrompt } from "./skills";
import { executeBand, listAvailableTargets, isTargetAvailable } from "./executors";

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "deploy":
      await deploy(args);
      break;
    case "init":
      await init(args);
      break;
    case "validate":
      await validate(args);
      break;
    case "run":
      await run(args);
      break;
    case "targets":
      await targets(args);
      break;
    case "wrap-skill":
      await wrapSkill(args);
      break;
    case "run-skill":
      await runSkill(args);
      break;
    case "validate-skill":
      await validateSkill(args);
      break;
    case "exec":
      await exec(args);
      break;
    case "convert-skill":
      await convertSkill(args);
      break;
    case "setup":
      await setup(args);
      break;
    case "teardown":
      await teardown();
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

function printUsage() {
  console.log(`
Band Runtime CLI

Commands:
  run <band.md> [options]            Execute a band with the specified target
  deploy <band.md> [--name <name>]   Deploy a new worker with band config
  init <url> <band.md>               Initialize an existing worker with band
  validate <band.md>                 Validate a band file
  targets                            List available execution targets
  wrap-skill <source> [--output]     Generate a band.md that wraps an AgentSkills.io skill
  run-skill <source> [--request]     Execute a skill locally with optional request
  validate-skill <dir>               Validate a banded skill directory
  exec <resource-dir> [--key=val]    Execute a banded script resource
  convert-skill <source> --output    Convert a skill to banded format
  setup [--force]                    Create and provision Lima VM
  teardown                           Stop and delete Lima VM

Execution Targets:
  local-dangerously   Run in current process (no isolation, no restrictions)
  local-lima          Run in Lima VM (full isolation and enforcement)
  cloudflare          Run on Cloudflare Workers (edge deployment)

Options:
  --target <target>  Execution target (default: from band or local-dangerously)
  --input <json>     Input payload as JSON string
  --input-file <f>   Read input from JSON file
  --name <name>      Worker name (default: derived from band name)
  --dry-run          Show what would be deployed without deploying
  --output <file>    Output file for wrap-skill (default: stdout)
  --request <text>   Request/input text for run-skill
  --verbose          Enable verbose logging

Examples:
  bun run src/cli.ts run ./my-band.md --input '{"task": "process"}'
  bun run src/cli.ts run ./my-band.md --target local-lima --input-file request.json
  bun run src/cli.ts run ./my-band.md --target cloudflare
  bun run src/cli.ts targets
  bun run src/cli.ts deploy ./my-band.md --name my-worker
  bun run src/cli.ts validate ./my-band.md
  bun run src/cli.ts wrap-skill github.com/user/repo/tree/main/skills/my-skill
`);
}

async function deploy(args: string[]) {
  const bandPath = args.find((a) => !a.startsWith("--"));
  const nameIdx = args.indexOf("--name");
  const workerName = nameIdx !== -1 ? args[nameIdx + 1] : null;
  const dryRun = args.includes("--dry-run");

  if (!bandPath) {
    console.error("Error: Band file path required");
    process.exit(1);
  }

  // Parse the band file
  const content = readFileSync(bandPath, "utf-8");
  const result = parseBandMd(content);

  if (result.errors.length > 0) {
    console.error("Band validation errors:");
    for (const err of result.errors) {
      console.error(`  - ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }

  const band = result.document;
  const name = workerName || slugify(band.band) || "band-runtime";

  console.log(`Deploying band "${band.band}" as worker "${name}"...`);

  // Compile to verify all references
  console.log("Compiling band...");
  const compiled = compileBand(band);

  console.log("  Limits:", compiled.limits);
  console.log("  Firewall:", {
    allowedDns: [...compiled.firewall.allowedDns],
    defaultEgress: compiled.firewall.defaultEgress,
  });

  if (dryRun) {
    console.log("\n[Dry run] Would deploy with config:");
    console.log(JSON.stringify(band, null, 2));
    return;
  }

  // Generate wrangler.toml with band config
  const wranglerConfig = `
name = "${name}"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[vars]
BAND_CONFIG = '''
${JSON.stringify(band)}
'''
`;

  writeFileSync("wrangler.toml", wranglerConfig);
  console.log("Generated wrangler.toml");

  // Run wrangler deploy
  const proc = Bun.spawn(["bunx", "wrangler", "deploy"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await proc.exited;

  if (proc.exitCode === 0) {
    console.log(`\nSuccessfully deployed ${name}!`);
  } else {
    console.error(`\nDeployment failed with exit code ${proc.exitCode}`);
    process.exit(proc.exitCode ?? 1);
  }
}

async function init(args: string[]) {
  const [url, bandPath] = args.filter((a) => !a.startsWith("--"));

  if (!url || !bandPath) {
    console.error("Error: Both worker URL and band file path required");
    process.exit(1);
  }

  // Parse the band file
  const content = readFileSync(bandPath, "utf-8");
  const result = parseBandMd(content);

  if (result.errors.length > 0) {
    console.error("Band validation errors:");
    for (const err of result.errors) {
      console.error(`  - ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }

  const band = result.document;
  console.log(`Initializing ${url} with band "${band.band}"...`);

  // POST to /init endpoint
  const resp = await fetch(`${url.replace(/\/$/, "")}/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(band),
  });

  const body = (await resp.json()) as { ok?: boolean; band?: string; error?: string };

  if (resp.ok && body.ok) {
    console.log(`Successfully initialized worker with band "${body.band}"`);
  } else {
    console.error("Initialization failed:", body.error || body);
    process.exit(1);
  }
}

async function validate(args: string[]) {
  const bandPath = args.find((a) => !a.startsWith("--"));

  if (!bandPath) {
    console.error("Error: Band file path required");
    process.exit(1);
  }

  const content = readFileSync(bandPath, "utf-8");
  const result = parseBandMd(content);

  if (result.errors.length > 0) {
    console.error("Validation errors:");
    for (const err of result.errors) {
      console.error(`  - ${err.path}: ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warn of result.warnings) {
      console.warn(`  - ${warn.path}: ${warn.message}`);
    }
  }

  console.log("\nCompiling band...");
  try {
    const compiled = compileBand(result.document);
    console.log("Band compiles successfully!");
    console.log("\nLimits:", compiled.limits);
    console.log("Firewall:", {
      allowedDns: [...compiled.firewall.allowedDns],
      defaultEgress: compiled.firewall.defaultEgress,
    });

    if (result.errors.length === 0) {
      console.log("\n✓ Band is valid and ready for deployment");
    }
  } catch (err) {
    console.error("Compilation failed:", err);
    process.exit(1);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function wrapSkill(args: string[]) {
  const source = args.find((a) => !a.startsWith("--"));
  const outputIdx = args.indexOf("--output");
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  if (!source) {
    console.error("Error: Skill source required (GitHub URL or local path)");
    process.exit(1);
  }

  console.log(`Fetching skill from ${source}...`);

  try {
    // Fetch the skill
    const skill = await fetchSkill(source);
    console.log(`Loaded skill: ${skill.frontmatter.name}`);
    console.log(`  Description: ${skill.frontmatter.description}`);
    console.log(`  Scripts: ${[...skill.scripts.keys()].join(", ") || "none"}`);
    console.log(`  References: ${[...skill.references.keys()].join(", ") || "none"}`);

    // Generate the band
    const band = generateSkillBand(skill);

    // Export to BAND.md format
    const bandMd = exportBandMd(band);

    if (outputFile) {
      writeFileSync(outputFile, bandMd);
      console.log(`\nGenerated band written to: ${outputFile}`);
    } else {
      console.log("\n--- Generated BAND.md ---\n");
      console.log(bandMd);
    }

    // Also show the system prompt
    console.log("\n--- System Prompt ---\n");
    const prompt = generateSkillSystemPrompt(skill);
    console.log(prompt.slice(0, 500) + (prompt.length > 500 ? "..." : ""));
  } catch (err) {
    console.error("Failed to wrap skill:", err);
    process.exit(1);
  }
}

async function runSkill(args: string[]) {
  const source = args.find((a) => !a.startsWith("--"));
  const requestIdx = args.indexOf("--request");
  const request = requestIdx !== -1 ? args[requestIdx + 1] : "";

  if (!source) {
    console.error("Error: Skill source required (GitHub URL or local path)");
    process.exit(1);
  }

  console.log(`Fetching skill from ${source}...`);

  try {
    const { executeSkill, createSkillContext } = await import("./skills");

    // Fetch the skill
    const skill = await fetchSkill(source);
    console.log(`Loaded skill: ${skill.frontmatter.name}`);

    // Create execution context
    const context = createSkillContext(
      request,
      fetch, // Use unrestricted fetch for local testing
      {},
      process.cwd()
    );

    console.log(`\nExecuting skill with request: "${request || "(empty)"}"...\n`);

    // Execute the skill
    const result = await executeSkill(skill, context);

    console.log("--- Execution Result ---");
    console.log(`Success: ${result.success}`);
    console.log(`Duration: ${result.duration_ms}ms`);
    console.log(`Scripts run: ${result.scripts_run.join(", ") || "none"}`);

    if (result.output) {
      console.log("\n--- Output ---");
      console.log(result.output);
    }

    if (result.error) {
      console.log("\n--- Error ---");
      console.log(result.error);
    }

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error("Failed to run skill:", err);
    process.exit(1);
  }
}

async function convertSkill(args: string[]) {
  const source = args.find((a) => !a.startsWith("--"));
  const outputIdx = args.indexOf("--output");
  const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  if (!source) {
    console.error("Error: Skill source required (GitHub URL or local path)");
    process.exit(1);
  }

  if (!outputDir && !dryRun) {
    console.error("Error: --output <dir> required (or use --dry-run)");
    process.exit(1);
  }

  const { convertToBandedSkill } = await import("./banded-skills/converter");

  const result = await convertToBandedSkill(source, outputDir || "/dev/null", {
    dryRun,
    verbose,
  });

  if (result.success) {
    console.log(`\nGenerated ${result.files.length} files:`);
    for (const file of result.files) {
      console.log(`  ${file}`);
    }

    if (result.validation) {
      if (result.validation.valid) {
        console.log("\n✓ Generated skill passes validation");
      } else {
        console.error(`\n✗ Generated skill has ${result.validation.errors.length} error(s)`);
      }
    }
  } else {
    console.error(`\nConversion failed: ${result.error}`);
    process.exit(1);
  }
}

async function exec(args: string[]) {
  const { parseExecArgs, bandExec } = await import("./banded-skills/exec");
  const options = parseExecArgs(args);

  if (!options.resourceDir) {
    console.error("Error: Script resource directory required");
    console.error("Usage: band exec <resource-dir> [--key=value...] [--input_path=...] [--output_path=...] [--help]");
    process.exit(1);
  }

  const result = await bandExec(options);

  if (result.success) {
    if (options.help) {
      console.log(result.data);
    } else if (!options.outputPath && result.data !== undefined) {
      // Print to stdout if no output path specified
      if (typeof result.data === "string") {
        console.log(result.data);
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }
    }

    if (result.metrics) {
      console.error(`Duration: ${result.metrics.durationMs}ms`);
    }
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

async function validateSkill(args: string[]) {
  const skillDir = args.find((a) => !a.startsWith("--"));

  if (!skillDir) {
    console.error("Error: Skill directory path required");
    process.exit(1);
  }

  const { validateBandedSkill } = await import("./banded-skills");
  const result = validateBandedSkill(skillDir);

  if (result.errors.length > 0) {
    console.error("Validation errors:");
    for (const err of result.errors) {
      console.error(`  ✗ ${err.path}: ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warn of result.warnings) {
      console.warn(`  ⚠ ${warn.path}: ${warn.message}`);
    }
  }

  if (result.valid) {
    console.log("\n✓ Banded skill is valid");
  } else {
    console.error(`\n✗ Banded skill has ${result.errors.length} error(s)`);
    process.exit(1);
  }
}

async function run(args: string[]) {
  const bandPath = args.find((a) => !a.startsWith("--"));
  const targetIdx = args.indexOf("--target");
  const targetOverride = targetIdx !== -1 ? args[targetIdx + 1] : null;
  const inputIdx = args.indexOf("--input");
  const inputJson = inputIdx !== -1 ? args[inputIdx + 1] : null;
  const inputFileIdx = args.indexOf("--input-file");
  const inputFile = inputFileIdx !== -1 ? args[inputFileIdx + 1] : null;
  const verbose = args.includes("--verbose");

  if (!bandPath) {
    console.error("Error: Band file path required");
    process.exit(1);
  }

  // Parse the band file
  const content = readFileSync(bandPath, "utf-8");
  const result = parseBandMd(content);

  if (result.errors.length > 0) {
    console.error("Band validation errors:");
    for (const err of result.errors) {
      console.error(`  - ${err.path}: ${err.message}`);
    }
    process.exit(1);
  }

  const band = result.document;

  // Parse input payload
  let payload: unknown = {};
  if (inputJson) {
    try {
      payload = JSON.parse(inputJson);
    } catch (err) {
      console.error("Error: Invalid JSON in --input");
      process.exit(1);
    }
  } else if (inputFile) {
    try {
      const inputContent = readFileSync(inputFile, "utf-8");
      payload = JSON.parse(inputContent);
    } catch (err) {
      console.error(`Error: Could not read or parse input file: ${inputFile}`);
      process.exit(1);
    }
  }

  // Determine execution target
  const target = (targetOverride || band.execution?.target || "local-dangerously") as ExecutionTarget;

  // Check if target is available
  const available = await isTargetAvailable(target);
  if (!available) {
    console.error(`Error: Execution target "${target}" is not available on this system`);
    if (target === "local-lima") {
      console.error("  Make sure Lima VM is running (limactl start bands-executor)");
    } else if (target === "cloudflare") {
      console.error("  Make sure wrangler is installed and CLOUDFLARE_API_TOKEN is set");
    }
    process.exit(1);
  }

  console.log(`Executing band "${band.band}" on target: ${target}`);
  if (verbose) {
    console.log(`  Input: ${JSON.stringify(payload).slice(0, 100)}...`);
  }

  try {
    const execResult = await executeBand(band, payload, {
      target,
      workdir: process.cwd(),
    });

    if (execResult.success) {
      console.log("\n--- Execution Successful ---");
      console.log(`Duration: ${execResult.metrics.durationMs}ms`);
      console.log(`Startup: ${execResult.metrics.startupMs}ms`);
      console.log(`Input bytes: ${execResult.metrics.inputBytes}`);
      console.log(`Output bytes: ${execResult.metrics.outputBytes}`);
      console.log(`Target: ${execResult.target}`);
      console.log("\n--- Output ---");
      console.log(JSON.stringify(execResult.data, null, 2));
    } else {
      console.error("\n--- Execution Failed ---");
      console.error(`Error code: ${execResult.error?.code}`);
      console.error(`Message: ${execResult.error?.message}`);
      console.error(`Duration: ${execResult.metrics.durationMs}ms`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Execution error:", err);
    process.exit(1);
  }
}

async function targets(_args: string[]) {
  console.log("Checking available execution targets...\n");

  const availableTargets = await listAvailableTargets();

  const allTargets: Array<{
    name: ExecutionTarget;
    description: string;
    isolation: string;
    requires?: string;
  }> = [
    {
      name: "local-dangerously",
      description: "Run in current process (no isolation)",
      isolation: "None - full system access",
    },
    {
      name: "local-lima",
      description: "Run in Lima VM (macOS)",
      isolation: "Full - Linux VM via Virtualization.framework",
      requires: "limactl + bands-executor VM running",
    },
    {
      name: "cloudflare",
      description: "Run on Cloudflare Workers",
      isolation: "Full - V8 isolates, edge deployment",
      requires: "wrangler + CLOUDFLARE_API_TOKEN",
    },
  ];

  for (const target of allTargets) {
    const isAvailable = availableTargets.includes(target.name);
    const status = isAvailable ? "✓" : "✗";
    const color = isAvailable ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";

    console.log(`${color}${status}${reset} ${target.name}`);
    console.log(`    ${target.description}`);
    console.log(`    Isolation: ${target.isolation}`);
    if (!isAvailable && target.requires) {
      console.log(`    ${color}Requires: ${target.requires}${reset}`);
    }
    console.log();
  }

  console.log(`\nAvailable targets: ${availableTargets.join(", ") || "none"}`);
}

async function setup(args: string[]) {
  const force = args.includes("--force");
  const { setupLima } = await import("./setup");
  await setupLima({ force });
}

async function teardown() {
  const { teardownLima } = await import("./setup");
  await teardownLima();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
