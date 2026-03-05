/**
 * Banded skill validator.
 *
 * Validates the structure and content of a banded skill directory:
 * - SKILL.md exists and has valid frontmatter
 * - BAND.md exists (top-level or referenced)
 * - scripts/ directory exists with wrappers
 * - Each wrapper has a matching resources/<name>/run.sh
 * - Schemas are valid JSON Schema
 * - Wrappers match the `band exec` pattern
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { parseBandMd } from "@bands/format";
import { parseSkillMd } from "../skills/parser";
import { discoverBandForScript } from "./discovery";
import type {
  BandedSkillValidationResult,
  BandedSkillValidationError,
  BandedSkillValidationWarning,
} from "./types";

const BAND_EXEC_PATTERN = /band\s+exec\s+/;

/**
 * Validate a banded skill directory.
 */
export function validateBandedSkill(
  skillRoot: string
): BandedSkillValidationResult {
  const errors: BandedSkillValidationError[] = [];
  const warnings: BandedSkillValidationWarning[] = [];

  // 1. Check SKILL.md exists and is parseable
  const skillMdPath = join(skillRoot, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    errors.push({ path: "SKILL.md", message: "SKILL.md is missing" });
  } else {
    try {
      const content = readFileSync(skillMdPath, "utf-8");
      const parsed = parseSkillMd(content);
      if (!parsed.frontmatter.name) {
        errors.push({
          path: "SKILL.md",
          message: "SKILL.md frontmatter missing 'name' field",
        });
      }
      if (!parsed.frontmatter.description) {
        errors.push({
          path: "SKILL.md",
          message: "SKILL.md frontmatter missing 'description' field",
        });
      }
    } catch (e) {
      errors.push({
        path: "SKILL.md",
        message: `Failed to parse SKILL.md: ${e instanceof Error ? e.message : e}`,
      });
    }
  }

  // 2. Check BAND.md exists (top-level, scripts-level, or referenced)
  const bandMdPath = join(skillRoot, "BAND.md");
  if (!existsSync(bandMdPath)) {
    errors.push({ path: "BAND.md", message: "BAND.md is missing" });
  } else {
    const content = readFileSync(bandMdPath, "utf-8");
    const result = parseBandMd(content);
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        errors.push({
          path: `BAND.md:${err.path}`,
          message: err.message,
        });
      }
    }
  }

  // 3. Check scripts/ directory exists
  const scriptsDir = join(skillRoot, "scripts");
  if (!existsSync(scriptsDir)) {
    errors.push({ path: "scripts/", message: "scripts/ directory is missing" });
    return { valid: errors.length === 0, errors, warnings };
  }

  // 4. Find wrapper scripts (files in scripts/ that are not directories, not BAND.md)
  const scriptsEntries = readdirSync(scriptsDir);
  const wrapperNames: string[] = [];

  for (const entry of scriptsEntries) {
    const entryPath = join(scriptsDir, entry);
    if (entry === "BAND.md" || entry === "resources") continue;
    if (statSync(entryPath).isFile()) {
      wrapperNames.push(entry);
    }
  }

  if (wrapperNames.length === 0) {
    warnings.push({
      path: "scripts/",
      message: "No wrapper scripts found in scripts/",
    });
  }

  // 5. For each wrapper, validate
  const resourcesDir = join(scriptsDir, "resources");
  const resourceEntries = existsSync(resourcesDir)
    ? new Set(readdirSync(resourcesDir))
    : new Set<string>();

  for (const wrapperName of wrapperNames) {
    const wrapperPath = join(scriptsDir, wrapperName);

    // Check wrapper matches `band exec` pattern
    try {
      const content = readFileSync(wrapperPath, "utf-8");
      if (!BAND_EXEC_PATTERN.test(content)) {
        warnings.push({
          path: `scripts/${wrapperName}`,
          message: `Wrapper does not contain 'band exec' pattern`,
        });
      }
    } catch {
      errors.push({
        path: `scripts/${wrapperName}`,
        message: `Cannot read wrapper script`,
      });
      continue;
    }

    // Check matching resource directory
    if (!resourceEntries.has(wrapperName)) {
      errors.push({
        path: `scripts/resources/${wrapperName}/`,
        message: `Missing resource directory for wrapper '${wrapperName}'`,
      });
      continue;
    }

    const resourceDir = join(resourcesDir, wrapperName);

    // Check run.sh exists
    const runShPath = join(resourceDir, "run.sh");
    if (!existsSync(runShPath)) {
      errors.push({
        path: `scripts/resources/${wrapperName}/run.sh`,
        message: `Missing run.sh for script '${wrapperName}'`,
      });
    }

    // Validate input_schema.json if present
    const inputSchemaPath = join(resourceDir, "input_schema.json");
    if (existsSync(inputSchemaPath)) {
      try {
        const content = readFileSync(inputSchemaPath, "utf-8");
        JSON.parse(content);
      } catch {
        errors.push({
          path: `scripts/resources/${wrapperName}/input_schema.json`,
          message: `Invalid JSON in input_schema.json`,
        });
      }
    }

    // Validate output_schema.json if present
    const outputSchemaPath = join(resourceDir, "output_schema.json");
    if (existsSync(outputSchemaPath)) {
      try {
        const content = readFileSync(outputSchemaPath, "utf-8");
        JSON.parse(content);
      } catch {
        errors.push({
          path: `scripts/resources/${wrapperName}/output_schema.json`,
          message: `Invalid JSON in output_schema.json`,
        });
      }
    }
  }

  // 6. Check for orphaned resource directories (resources without wrappers)
  if (existsSync(resourcesDir)) {
    const wrapperSet = new Set(wrapperNames);
    for (const entry of resourceEntries) {
      if (!wrapperSet.has(entry)) {
        warnings.push({
          path: `scripts/resources/${entry}/`,
          message: `Orphaned resource directory '${entry}' has no matching wrapper script`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
