/**
 * Band exec — execute a banded skill script.
 *
 * Handles:
 * 1. CLI arg parsing (--key=value, --input_path, --output_path, --help)
 * 2. --help: read schemas, print formatted help, exit
 * 3. Band discovery for the script
 * 4. Input validation against centralized schemas/input/<name>.json
 * 5. Delegation to the target-specific executor
 * 6. Output validation against centralized schemas/output/<name>.json
 * 7. Output routing to --output_path or stdout
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve, basename, dirname } from "path";
import { discoverBandForScript } from "./discovery";
import { loadSchemas, loadBandConfigSchema, createValidator } from "./schema-loader";
import type { BandExecOptions, BandExecResult } from "./types";

/**
 * Parse CLI arguments for band exec.
 *
 * Supported forms:
 *   --key=value
 *   --key value
 *   --input_path=/path/to/input.json
 *   --output_path=/path/to/output.json
 *   --help
 */
export function parseExecArgs(argv: string[]): BandExecOptions {
  const args: Record<string, string> = {};
  let resourceDir = "";
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let help = false;
  let skillRoot: string | undefined;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

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

      switch (key) {
        case "input_path":
          inputPath = value;
          break;
        case "output_path":
          outputPath = value;
          break;
        case "skill_root":
          skillRoot = value;
          break;
        default:
          args[key] = value;
          break;
      }
    } else if (!resourceDir) {
      resourceDir = arg;
    }

    i++;
  }

  return { resourceDir, args, inputPath, outputPath, help, skillRoot };
}

/**
 * Print help for a script by reading its schemas.
 * Uses centralized schemas/ dir when skillRoot is provided, falls back to co-located.
 */
export function printHelp(resourceDir: string, skillRoot?: string): string {
  const lines: string[] = [];
  const scriptName = basename(resourceDir);

  lines.push(`Script: ${scriptName}`);
  lines.push("");

  // Load schemas from centralized or co-located location
  let inputSchema: Record<string, unknown> | undefined;
  let outputSchema: Record<string, unknown> | undefined;

  if (skillRoot) {
    const schemas = loadSchemas(skillRoot, scriptName);
    inputSchema = schemas.input;
    outputSchema = schemas.output;
  } else {
    // Direct resourceDir mode (no skillRoot) — try co-located
    const inputSchemaPath = join(resourceDir, "input_schema.json");
    if (existsSync(inputSchemaPath)) {
      inputSchema = JSON.parse(readFileSync(inputSchemaPath, "utf-8"));
    }
    const outputSchemaPath = join(resourceDir, "output_schema.json");
    if (existsSync(outputSchemaPath)) {
      outputSchema = JSON.parse(readFileSync(outputSchemaPath, "utf-8"));
    }
  }

  // Print input schema
  if (inputSchema) {
    lines.push("Input Schema:");
    lines.push(JSON.stringify(inputSchema, null, 2));
    lines.push("");

    // Print properties as flags
    if ((inputSchema as any).properties) {
      lines.push("Arguments:");
      for (const [key, prop] of Object.entries(
        (inputSchema as any).properties as Record<string, any>
      )) {
        const required = (inputSchema as any).required?.includes(key) ? " (required)" : "";
        const desc = prop.description ? ` - ${prop.description}` : "";
        const type = prop.type ? ` [${prop.type}]` : "";
        lines.push(`  --${key}${type}${desc}${required}`);
      }
      lines.push("");
    }
  } else {
    lines.push("Input Schema: (none)");
    lines.push("");
  }

  // Print output schema
  if (outputSchema) {
    lines.push("Output Schema:");
    lines.push(JSON.stringify(outputSchema, null, 2));
    lines.push("");
  } else {
    lines.push("Output Schema: (none)");
    lines.push("");
  }

  // Generic options
  lines.push("Generic Options:");
  lines.push("  --input_path <path>   Read input from a JSON file instead of CLI args");
  lines.push("  --output_path <path>  Write output to a file instead of stdout");
  lines.push("  --help, -h            Show this help");

  return lines.join("\n");
}

/**
 * Validate data against a JSON Schema using a pre-loaded Ajv instance.
 * The Ajv instance has all defs pre-loaded so $ref works.
 */
async function validateAgainstSchema(
  data: unknown,
  schema: Record<string, unknown>,
  label: string,
  skillRoot?: string,
  opts?: { coerceTypes?: boolean }
): Promise<string | null> {
  const Ajv = (await import("ajv")).default;
  let ajv: InstanceType<typeof Ajv>;

  if (skillRoot) {
    ajv = await createValidator(skillRoot, opts);
  } else {
    ajv = new Ajv({ allErrors: true, ...(opts?.coerceTypes && { coerceTypes: true }) });
  }

  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid && validate.errors) {
    const messages = validate.errors.map(
      (e) => `${e.instancePath || "/"}: ${e.message}`
    );
    return `${label} validation failed: ${messages.join("; ")}`;
  }
  return null;
}

/**
 * Execute a banded skill script.
 */
export async function bandExec(options: BandExecOptions): Promise<BandExecResult> {
  const { resourceDir, args, inputPath, outputPath, help, skillRoot, forceLima } = options;
  const startTime = Date.now();

  // Resolve resource directory
  const resolvedResourceDir = resolve(resourceDir);
  const scriptName = basename(resolvedResourceDir);

  // Help mode: print schemas and exit
  if (help) {
    const helpText = printHelp(resolvedResourceDir, skillRoot);
    return { success: true, data: helpText };
  }

  // Check run.sh exists
  const runShPath = join(resolvedResourceDir, "run.sh");
  if (!existsSync(runShPath)) {
    return {
      success: false,
      error: `run.sh not found at ${runShPath}`,
    };
  }

  // Build input data
  let inputData: Record<string, unknown> = { ...args };
  if (inputPath) {
    try {
      const content = readFileSync(inputPath, "utf-8");
      inputData = JSON.parse(content);
    } catch (e) {
      return {
        success: false,
        error: `Failed to read input from ${inputPath}: ${e instanceof Error ? e.message : e}`,
      };
    }
  }

  // Load input schema from centralized location (with co-located fallback)
  let inputSchemaObj: Record<string, unknown> | undefined;
  if (skillRoot) {
    const schemas = loadSchemas(skillRoot, scriptName);
    inputSchemaObj = schemas.input;
  } else {
    const legacyPath = join(resolvedResourceDir, "input_schema.json");
    if (existsSync(legacyPath)) {
      inputSchemaObj = JSON.parse(readFileSync(legacyPath, "utf-8"));
    }
  }

  // Validate input against schema if present
  // Ajv with coerceTypes handles string→integer/number/boolean coercion,
  // including through $ref resolution (e.g. "$ref": "limit.json" → type: "integer")
  if (inputSchemaObj) {
    const error = await validateAgainstSchema(inputData, inputSchemaObj, "Input", skillRoot, { coerceTypes: true });
    if (error) {
      return { success: false, error };
    }
  }

  // Discover band for this script
  let executionTarget = "local-dangerously";
  let envSecrets: Record<string, string> = {};
  let bandConfig: Record<string, unknown> | undefined;
  let allowNet: string[] = [];
  let denyNet: string[] = [];
  let allowCli: string[] = [];
  let denyCli: string[] = [];
  let allowRead: string[] = [];
  let allowWrite: string[] = [];
  let insist: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] } | undefined;
  if (skillRoot) {
    const discovery = discoverBandForScript(skillRoot, scriptName);
    if (discovery?.band?.execution?.target) {
      executionTarget = discovery.band.execution.target;
    }
    if (discovery?.band?.bandConfig) {
      bandConfig = discovery.band.bandConfig;
    }
    if (discovery?.band?.allow?.net) {
      allowNet = discovery.band.allow.net;
    }
    if (discovery?.band?.deny?.net) {
      denyNet = discovery.band.deny.net;
    }
    if (discovery?.band?.allow?.cli) {
      allowCli = discovery.band.allow.cli;
    }
    if (discovery?.band?.deny?.cli) {
      denyCli = discovery.band.deny.cli;
    }
    if (discovery?.band?.allow?.read) {
      allowRead = discovery.band.allow.read;
    }
    if (discovery?.band?.allow?.write) {
      allowWrite = discovery.band.allow.write;
    }
    if (discovery?.band?.insist) {
      insist = {
        cli: discovery.band.insist.cli,
        read: discovery.band.insist.read,
        write: discovery.band.insist.write,
        net: discovery.band.insist.net,
      };
    }
    // Check required secrets are present
    const requiredSecrets = discovery?.band?.requires?.secrets || [];
    const missingSecrets = requiredSecrets.filter((key: string) => !process.env[key]);
    if (missingSecrets.length > 0) {
      return {
        success: false,
        error: `Missing required secret${missingSecrets.length > 1 ? "s" : ""}: ${missingSecrets.join(", ")}\nSet ${missingSecrets.length > 1 ? "them" : "it"} in your environment: export ${missingSecrets.map((k: string) => `${k}=<value>`).join(" ")}`,
      };
    }

    // Collect env secrets declared in BAND.md from host environment
    if (discovery?.band?.env?.secrets) {
      for (const key of discovery.band.env.secrets) {
        const value = process.env[key];
        if (value) {
          envSecrets[key] = value;
        }
      }
    }

    // Validate bandConfig against band-config.schema.json if present
    if (bandConfig) {
      const bandConfigSchema = loadBandConfigSchema(skillRoot);
      if (bandConfigSchema) {
        const error = await validateAgainstSchema(bandConfig, bandConfigSchema, "bandConfig", skillRoot);
        if (error) {
          return { success: false, error };
        }
      }
    }
  }

  // Force Lima execution if requested — reject local-dangerously
  if (forceLima && executionTarget === "local-dangerously") {
    executionTarget = "local-lima";
  }

  // Create temp files for input/output
  const { mkdtempSync, rmSync } = await import("fs");
  const { tmpdir } = await import("os");
  const tempDir = mkdtempSync(join(tmpdir(), "band-exec-"));

  try {
    const tempInputPath = join(tempDir, "input.json");
    const tempOutputPath = join(tempDir, "output.json");

    writeFileSync(tempInputPath, JSON.stringify(inputData));

    // Write band config if present
    let configPath: string | undefined;
    if (bandConfig) {
      configPath = join(tempDir, "config.json");
      writeFileSync(configPath, JSON.stringify(bandConfig));
    }

    // Execute based on target
    const result = await executeScript(
      runShPath,
      resolvedResourceDir,
      tempInputPath,
      tempOutputPath,
      executionTarget,
      envSecrets,
      skillRoot,
      configPath,
      { allowNet, denyNet },
      { allowCli, denyCli, allowRead, allowWrite, insist }
    );

    if (!result.success) {
      return result;
    }

    // Read output
    let outputData: unknown = result.data;
    if (existsSync(tempOutputPath)) {
      try {
        outputData = JSON.parse(readFileSync(tempOutputPath, "utf-8"));
      } catch {
        outputData = readFileSync(tempOutputPath, "utf-8");
      }
    }

    // Load output schema from centralized location (with co-located fallback)
    let outputSchemaObj: Record<string, unknown> | undefined;
    if (skillRoot) {
      const schemas = loadSchemas(skillRoot, scriptName);
      outputSchemaObj = schemas.output;
    } else {
      const legacyPath = join(resolvedResourceDir, "output_schema.json");
      if (existsSync(legacyPath)) {
        outputSchemaObj = JSON.parse(readFileSync(legacyPath, "utf-8"));
      }
    }

    // Validate output against schema if present
    if (outputSchemaObj && outputData !== undefined) {
      const error = await validateAgainstSchema(outputData, outputSchemaObj, "Output", skillRoot);
      if (error) {
        return { success: false, error };
      }
    }

    // Write output to path or return
    if (outputPath) {
      writeFileSync(
        outputPath,
        typeof outputData === "string"
          ? outputData
          : JSON.stringify(outputData, null, 2)
      );
    }

    const durationMs = Date.now() - startTime;
    const inputBytes = JSON.stringify(inputData).length;
    const outputBytes = outputData
      ? JSON.stringify(outputData).length
      : 0;

    return {
      success: true,
      data: outputData,
      metrics: { durationMs, inputBytes, outputBytes },
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Execute a run.sh script with the given input/output paths.
 */
async function executeScript(
  runShPath: string,
  resourceDir: string,
  inputPath: string,
  outputPath: string,
  executionTarget: string,
  envSecrets: Record<string, string> = {},
  skillRoot?: string,
  configPath?: string,
  networkRules?: { allowNet: string[]; denyNet: string[] },
  fileRules?: { allowCli: string[]; denyCli: string[]; allowRead: string[]; allowWrite: string[]; insist?: { cli?: string[]; read?: string[]; write?: string[]; net?: string[] } }
): Promise<BandExecResult> {
  if (executionTarget === "local-lima") {
    // Delegate to lima-exec
    const { limaExec } = await import("./lima-exec");
    return limaExec(runShPath, resourceDir, inputPath, outputPath, undefined, envSecrets, skillRoot, configPath, networkRules, fileRules);
  }

  // Default: local-dangerously — run directly
  const env: Record<string, string | undefined> = {
    ...process.env,
    INPUT_PATH: inputPath,
    OUTPUT_PATH: outputPath,
  };
  if (configPath) {
    env.CONFIG_PATH = configPath;
  }
  const proc = Bun.spawn(["bash", runShPath], {
    cwd: resourceDir,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (exitCode !== 0) {
    // Scripts write {"error": "..."} to OUTPUT_PATH on failure — read it
    let errorMessage = stderr || stdout;
    try {
      const outputContent = readFileSync(outputPath, "utf-8").trim();
      if (outputContent) {
        try {
          const parsed = JSON.parse(outputContent);
          if (parsed.error) errorMessage = parsed.error;
        } catch {
          // Not valid JSON — try to extract error field, else use raw content
          const match = outputContent.match(/"error"\s*:\s*"(.+)/s);
          errorMessage = match ? match[1].replace(/"\s*}\s*$/, "") : outputContent;
        }
      }
    } catch {
      // No output file
    }
    return {
      success: false,
      error: errorMessage || `Script exited with code ${exitCode}`,
    };
  }

  // If no output file was written, use stdout
  let data: unknown = stdout.trim() || undefined;
  if (data && typeof data === "string") {
    try {
      data = JSON.parse(data as string);
    } catch {
      // Keep as string
    }
  }

  return { success: true, data };
}
