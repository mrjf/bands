/**
 * Generate a Band configuration that wraps an AgentSkills.io skill
 */

import type { BandDocument, CapabilitySet, FilesystemCapabilitySet, Capabilities, ExecutionTarget } from "@bands/format";
import type { LoadedSkill } from "./types";

export interface GenerateBandOptions {
  /** Override the band name (default: skill name) */
  name?: string;
  /** Override the band version (default: 1) */
  version?: number;
  /** Override the icon (default: 🔧) */
  icon?: string;
  /** Additional description text */
  descriptionSuffix?: string;
  /** Input schema URL */
  inputSchemaUrl?: string;
  /** Output schema URL */
  outputSchemaUrl?: string;
  /** Maximum runtime in ms (default: 30000) */
  maxRuntimeMs?: number;
  /** Maximum input size in bytes (default: 1MB) */
  maxInputBytes?: number;
  /** Maximum output size in bytes (default: 10MB) */
  maxOutputBytes?: number;
  /** Execution target (default: inferred from skill requirements) */
  executionTarget?: ExecutionTarget;
}

/**
 * Generate a BandDocument that wraps an AgentSkills.io skill.
 *
 * The generated band:
 * - Uses the skill's name and description
 * - Grants tools declared in allowed-tools
 * - Sets up appropriate network access if skill requires it
 * - Includes the skill source as a reference
 */
export function generateSkillBand(
  skill: LoadedSkill,
  options: GenerateBandOptions = {}
): BandDocument {
  const { frontmatter, instructions } = skill;

  // Parse allowed tools from frontmatter, or infer from instructions
  const allowedTools = parseAllowedTools(frontmatter["allowed-tools"], instructions);

  // Determine if network access is needed (from frontmatter or inferred from instructions)
  const needsNetwork = frontmatter.compatibility?.network ?? inferNetworkNeeds(instructions);

  // Check if localhost access is needed (for web testing skills)
  const needsLocalhost = inferLocalhostNeeds(instructions);

  // Determine execution target
  const executionTarget = options.executionTarget ?? inferExecutionTarget(allowedTools, needsNetwork, needsLocalhost);

  // Generate the system prompt body from skill instructions
  const body = generateSkillSystemPrompt(skill);

  // Build the band document - skills don't need schema validation,
  // they're instruction-based rather than API-based
  const band: BandDocument = {
    band: options.name || frontmatter.name,
    version: options.version ?? 1,
    icon: options.icon || "🔧",
    description: buildDescription(frontmatter.description, options.descriptionSuffix),

    returns: {
      supports: ["sync"],
      default: "sync",
    },

    execution: {
      target: executionTarget,
    },

    limits: {
      maxRuntimeMs: options.maxRuntimeMs ?? 30000,
      maxInputBytes: options.maxInputBytes ?? 1024 * 1024, // 1MB
      maxOutputBytes: options.maxOutputBytes ?? 10 * 1024 * 1024, // 10MB
    },

    // Set up capabilities based on skill requirements
    // Note: skills.allow is intentionally omitted - once a skill is invoked,
    // its instructions are loaded into context and executed with the allowed
    // tools. The skill doesn't need to "call itself" recursively.
    capabilities: {
      tools: buildToolsCapability(allowedTools),
      filesystem: buildFilesystemCapability(allowedTools),
      network: buildNetworkCapability(needsNetwork, needsLocalhost),
    },

    // Include skill instructions as body
    body,
  };

  return band;
}

/**
 * Parse the allowed-tools field from skill frontmatter.
 * Format: "Bash, Read, Write, Edit" or "Bash,Read,Write"
 *
 * If not specified, infer tools from the skill's instructions content.
 */
function parseAllowedTools(allowedTools?: string, instructions?: string): string[] {
  if (allowedTools) {
    return allowedTools
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // No allowed-tools specified - infer from instructions
  if (!instructions) return [];

  const inferredTools: string[] = [];
  const lowerInstructions = instructions.toLowerCase();

  // Check for bash/command-line usage indicators
  if (
    lowerInstructions.includes("```bash") ||
    lowerInstructions.includes("```sh") ||
    lowerInstructions.includes("python -m") ||
    lowerInstructions.includes("python scripts/") ||
    lowerInstructions.includes("npx ") ||
    lowerInstructions.includes("npm ") ||
    lowerInstructions.includes("bun ") ||
    lowerInstructions.includes("node ") ||
    lowerInstructions.includes("soffice") ||
    lowerInstructions.includes("pdftoppm")
  ) {
    inferredTools.push("Bash");
  }

  // Check for file reading indicators
  if (
    lowerInstructions.includes("read") ||
    lowerInstructions.includes("parse") ||
    lowerInstructions.includes("extract") ||
    lowerInstructions.includes("analyze")
  ) {
    inferredTools.push("Read");
  }

  // Check for file writing indicators
  if (
    lowerInstructions.includes("create") ||
    lowerInstructions.includes("write") ||
    lowerInstructions.includes("save") ||
    lowerInstructions.includes("generate")
  ) {
    inferredTools.push("Write");
  }

  // Check for file editing indicators
  if (
    lowerInstructions.includes("edit") ||
    lowerInstructions.includes("modify") ||
    lowerInstructions.includes("update")
  ) {
    inferredTools.push("Edit");
  }

  // Check for file searching indicators
  if (
    lowerInstructions.includes("find") ||
    lowerInstructions.includes("glob") ||
    lowerInstructions.includes("search")
  ) {
    inferredTools.push("Glob");
  }

  return inferredTools;
}

/**
 * Build description combining skill description with optional suffix.
 */
function buildDescription(base: string, suffix?: string): string {
  if (!suffix) return base;
  return `${base} ${suffix}`;
}

/**
 * Build tools capability based on allowed tools list.
 */
function buildToolsCapability(allowedTools: string[]): CapabilitySet {
  if (allowedTools.length === 0) {
    return { default: "deny" };
  }

  // Map common tool names to their full identifiers
  const toolMapping: Record<string, string> = {
    Bash: "claude:bash",
    Read: "claude:read",
    Write: "claude:write",
    Edit: "claude:edit",
    Glob: "claude:glob",
    Grep: "claude:grep",
    WebFetch: "claude:webfetch",
    WebSearch: "claude:websearch",
    Task: "claude:task",
    TodoWrite: "claude:todowrite",
    NotebookEdit: "claude:notebookedit",
  };

  const mappedTools = allowedTools.map(
    (tool) => toolMapping[tool] || `claude:${tool.toLowerCase()}`
  );

  return {
    default: "deny",
    allow: mappedTools,
  };
}

/**
 * Build filesystem capability based on allowed tools.
 */
function buildFilesystemCapability(allowedTools: string[]): FilesystemCapabilitySet {
  const hasRead = allowedTools.some((t) =>
    ["Read", "Glob", "Grep"].includes(t)
  );
  const hasWrite = allowedTools.some((t) =>
    ["Write", "Edit", "NotebookEdit"].includes(t)
  );

  const ops: string[] = [];

  if (hasRead) {
    ops.push("read:**/*");
  }
  if (hasWrite) {
    ops.push("write:**/*");
  }

  if (ops.length === 0) {
    return { default: "deny" };
  }

  return {
    default: "deny",
    allow: ops,
  };
}

/**
 * Infer if the skill needs network access from its instructions.
 */
function inferNetworkNeeds(instructions: string): boolean {
  const lowerInstructions = instructions.toLowerCase();

  // Check for network-related terms
  return (
    lowerInstructions.includes("http://") ||
    lowerInstructions.includes("https://") ||
    lowerInstructions.includes("localhost") ||
    lowerInstructions.includes("127.0.0.1") ||
    lowerInstructions.includes("api ") ||
    lowerInstructions.includes("fetch") ||
    lowerInstructions.includes("request") ||
    lowerInstructions.includes("web server") ||
    lowerInstructions.includes("playwright") ||
    lowerInstructions.includes("browser") ||
    lowerInstructions.includes("port ")
  );
}

/**
 * Infer if the skill needs localhost access for web testing.
 */
function inferLocalhostNeeds(instructions: string): boolean {
  const lowerInstructions = instructions.toLowerCase();

  // Check for local server/testing terms
  return (
    lowerInstructions.includes("localhost") ||
    lowerInstructions.includes("127.0.0.1") ||
    lowerInstructions.includes("local web") ||
    lowerInstructions.includes("local server") ||
    lowerInstructions.includes("local application") ||
    lowerInstructions.includes("web application testing") ||
    lowerInstructions.includes("playwright") ||
    lowerInstructions.includes(":5173") ||
    lowerInstructions.includes(":3000") ||
    lowerInstructions.includes(":8080") ||
    lowerInstructions.includes(":4200") ||
    lowerInstructions.includes("npm run dev") ||
    lowerInstructions.includes("with_server")
  );
}

/**
 * Infer the best execution target based on skill requirements.
 *
 * - Skills needing Bash, filesystem, or localhost → local-docker (isolated but has system access)
 * - Skills with only network needs → cloudflare (edge execution)
 * - Simple skills → cloudflare (fast, scalable)
 */
function inferExecutionTarget(
  allowedTools: string[],
  needsNetwork: boolean,
  needsLocalhost: boolean
): ExecutionTarget {
  // Skills that need system-level access should run in Docker
  const needsSystemAccess =
    allowedTools.includes("Bash") ||
    allowedTools.includes("Write") ||
    allowedTools.includes("Edit") ||
    needsLocalhost;

  if (needsSystemAccess) {
    return "local-docker";
  }

  // Default to Cloudflare for better isolation and scalability
  return "cloudflare";
}

/**
 * Build network capability based on skill requirements.
 */
function buildNetworkCapability(needsNetwork: boolean, needsLocalhost: boolean = false): Capabilities["network"] {
  if (!needsNetwork && !needsLocalhost) {
    return {
      egress: {
        default: "deny",
      },
    };
  }

  const allowedDns: string[] = [];

  // Add localhost access for web testing skills
  if (needsLocalhost) {
    allowedDns.push("localhost");
    allowedDns.push("127.0.0.1");
  }

  // Add common safe domains for network-enabled skills
  if (needsNetwork) {
    allowedDns.push(
      "*.githubusercontent.com",
      "api.github.com",
      "registry.npmjs.org",
      "pypi.org"
    );
  }

  return {
    egress: {
      default: "deny",
      allow_dns: allowedDns,
    },
  };
}

/**
 * Generate the system prompt that includes skill instructions.
 */
export function generateSkillSystemPrompt(skill: LoadedSkill): string {
  const parts: string[] = [];

  // Add skill header
  parts.push(`# Skill: ${skill.frontmatter.name}`);
  parts.push("");
  parts.push(skill.frontmatter.description);
  parts.push("");

  // Add main instructions
  parts.push("## Instructions");
  parts.push("");
  parts.push(skill.instructions);
  parts.push("");

  // Add references if any
  if (skill.references.size > 0) {
    parts.push("## References");
    parts.push("");
    for (const [filename, content] of skill.references) {
      parts.push(`### ${filename}`);
      parts.push("");
      parts.push(content);
      parts.push("");
    }
  }

  // Add available scripts
  if (skill.scripts.size > 0) {
    parts.push("## Available Scripts");
    parts.push("");
    for (const [filename, script] of skill.scripts) {
      parts.push(`- \`${filename}\` (${script.language})`);
    }
    parts.push("");
  }

  return parts.join("\n");
}
