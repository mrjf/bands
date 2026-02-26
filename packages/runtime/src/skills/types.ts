/**
 * Types for AgentSkills.io skill integration
 */

/** Parsed SKILL.md frontmatter */
export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: {
    systems?: string[];
    network?: boolean;
    products?: string[];
  };
  metadata?: Record<string, unknown>;
  "allowed-tools"?: string;
}

/** A fully loaded skill with all its resources */
export interface LoadedSkill {
  /** Skill metadata from frontmatter */
  frontmatter: SkillFrontmatter;

  /** The markdown instructions (body of SKILL.md) */
  instructions: string;

  /** Scripts from the scripts/ directory, keyed by filename */
  scripts: Map<string, SkillScript>;

  /** Reference docs from references/ directory */
  references: Map<string, string>;

  /** Static assets from assets/ directory */
  assets: Map<string, Uint8Array>;

  /** Source URL or path */
  source: string;
}

/** A script file from the skill */
export interface SkillScript {
  filename: string;
  language: "python" | "bash" | "javascript" | "typescript" | "unknown";
  content: string;
}

/** Result of executing a skill */
export interface SkillExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  scripts_run: string[];
  duration_ms: number;
}

/** Skill execution context */
export interface SkillContext {
  /** The user's request/input */
  request: string;

  /** Restricted fetch for network access */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  /** Environment variables available to scripts */
  env: Record<string, string>;

  /** Working directory for file operations */
  workdir: string;
}
