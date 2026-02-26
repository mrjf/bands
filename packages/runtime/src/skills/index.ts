/**
 * AgentSkills.io integration for Bands runtime
 *
 * This module provides:
 * - Fetching skills from GitHub or local filesystem
 * - Parsing SKILL.md files
 * - Generating Band configurations that wrap skills
 * - Executing skill scripts in a sandboxed environment
 */

// Types
export type {
  SkillFrontmatter,
  LoadedSkill,
  SkillScript,
  SkillExecutionResult,
  SkillContext,
} from "./types";

// Fetching
export { fetchSkill } from "./fetcher";

// Parsing
export { parseSkillMd } from "./parser";
export type { ParsedSkillMd } from "./parser";

// Band generation
export { generateSkillBand, generateSkillSystemPrompt } from "./generator";
export type { GenerateBandOptions } from "./generator";

// Execution
export { executeSkill, createSkillContext } from "./executor";
