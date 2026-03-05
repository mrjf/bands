/**
 * Types for the banded skills system.
 *
 * Banded skills package agent capabilities as sandboxed, script-based units.
 * Each script runs inside its own banded microVM with minimal permissions.
 */

import type { BandDocument } from "@bands/format";

/** A single script within a banded skill */
export interface BandedScript {
  /** Script name (e.g., "summarize-pull-request") */
  name: string;

  /** Absolute path to the script's resource directory (containing run.sh, schemas) */
  resourceDir: string;

  /** Absolute path to the wrapper script in scripts/ */
  wrapperPath: string;

  /** Input JSON Schema (parsed from input_schema.json, if present) */
  inputSchema?: Record<string, unknown>;

  /** Output JSON Schema (parsed from output_schema.json, if present) */
  outputSchema?: Record<string, unknown>;

  /** The discovered BAND.md for this script (most-specific wins) */
  band?: BandDocument;

  /** Where the BAND.md was discovered from */
  bandSource?: "per-script" | "scripts-level" | "top-level";
}

/** A fully loaded banded skill */
export interface BandedSkill {
  /** Skill name from SKILL.md frontmatter */
  name: string;

  /** Skill description from SKILL.md frontmatter */
  description: string;

  /** Root directory of the skill */
  root: string;

  /** All discovered scripts */
  scripts: BandedScript[];

  /** Top-level BAND.md document */
  topLevelBand?: BandDocument;
}

/** Result of validating a banded skill */
export interface BandedSkillValidationResult {
  /** Whether the skill is valid */
  valid: boolean;

  /** Validation errors (skill is invalid) */
  errors: BandedSkillValidationError[];

  /** Validation warnings (skill works but could be improved) */
  warnings: BandedSkillValidationWarning[];
}

export interface BandedSkillValidationError {
  path: string;
  message: string;
}

export interface BandedSkillValidationWarning {
  path: string;
  message: string;
}

/** Options for band exec */
export interface BandExecOptions {
  /** Path to the script resource directory */
  resourceDir: string;

  /** Key-value arguments (from --key=value CLI args) */
  args: Record<string, string>;

  /** Path to read input from (overrides args) */
  inputPath?: string;

  /** Path to write output to (default: stdout) */
  outputPath?: string;

  /** Show help/schema info instead of executing */
  help?: boolean;

  /** Root of the banded skill (for band discovery) */
  skillRoot?: string;
}

/** Result of band exec */
export interface BandExecResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Output data */
  data?: unknown;

  /** Error message if failed */
  error?: string;

  /** Execution metrics */
  metrics?: {
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
  };
}
