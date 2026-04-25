/**
 * Banded skill validator.
 *
 * Validates the structure and content of a banded skill directory:
 * - SKILL.md exists and has valid frontmatter
 * - BAND.md exists (top-level or referenced)
 * - scripts/ directory exists with wrappers
 * - Each wrapper has a matching resources/<name>/run.sh
 * - Schemas are valid JSON Schema (centralized or co-located)
 * - $ref targets resolve within the skill's schema defs
 * - Wrappers match the `band exec` pattern
 * - bandConfig matches band-config.schema.json if present
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { parseBandMd } from "@bands/format";
import { parseSkillMd } from "../skills/parser";
import { discoverBandForScript } from "./discovery";
import { loadSchemaDefs, loadBandConfigSchema } from "./schema-loader";
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
  let bandDoc: Record<string, unknown> | undefined;
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
    bandDoc = result.document as unknown as Record<string, unknown>;
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

  // Check if centralized schemas exist
  const schemasDir = join(skillRoot, "schemas");
  const hasCentralizedSchemas = existsSync(schemasDir);

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

    // Validate schemas — centralized or co-located
    if (hasCentralizedSchemas) {
      // Check centralized input schema
      const centralInputPath = join(schemasDir, "input", `${wrapperName}.json`);
      if (existsSync(centralInputPath)) {
        try {
          const content = readFileSync(centralInputPath, "utf-8");
          JSON.parse(content);
        } catch {
          errors.push({
            path: `schemas/input/${wrapperName}.json`,
            message: `Invalid JSON in centralized input schema`,
          });
        }
      } else {
        warnings.push({
          path: `schemas/input/${wrapperName}.json`,
          message: `No centralized input schema for script '${wrapperName}'`,
        });
      }

      // Check centralized output schema
      const centralOutputPath = join(schemasDir, "output", `${wrapperName}.json`);
      if (existsSync(centralOutputPath)) {
        try {
          const content = readFileSync(centralOutputPath, "utf-8");
          JSON.parse(content);
        } catch {
          errors.push({
            path: `schemas/output/${wrapperName}.json`,
            message: `Invalid JSON in centralized output schema`,
          });
        }
      }
    } else {
      // Fallback: validate co-located schemas
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

  // 7. Validate centralized schema directory if present
  if (hasCentralizedSchemas) {
    validateCentralizedSchemas(skillRoot, errors, warnings);
  }

  // 8. Validate bandConfig against band-config.schema.json if present
  if (bandDoc) {
    const bandConfigSchema = loadBandConfigSchema(skillRoot);
    if (bandConfigSchema && (bandDoc as any).bandConfig) {
      try {
        const Ajv = require("ajv").default || require("ajv");
        const ajv = new Ajv({ allErrors: true });

        // Load defs for $ref resolution
        const defs = loadSchemaDefs(skillRoot);
        for (const def of defs) {
          ajv.addSchema(def);
        }

        const validate = ajv.compile(bandConfigSchema);
        const valid = validate((bandDoc as any).bandConfig);
        if (!valid && validate.errors) {
          for (const err of validate.errors) {
            errors.push({
              path: `BAND.md:bandConfig${err.instancePath}`,
              message: `bandConfig validation: ${err.message}`,
            });
          }
        }
      } catch (e) {
        errors.push({
          path: "schemas/band-config.schema.json",
          message: `Failed to validate bandConfig: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate the centralized schemas/ directory:
 * - All JSON files parse as valid JSON
 * - All JSON Schema files compile with Ajv
 * - All $ref targets resolve (referenced defs exist)
 */
function validateCentralizedSchemas(
  skillRoot: string,
  errors: BandedSkillValidationError[],
  warnings: BandedSkillValidationWarning[]
): void {
  const schemasDir = join(skillRoot, "schemas");

  // Load defs first
  let defs: Record<string, unknown>[] = [];
  try {
    defs = loadSchemaDefs(skillRoot);
  } catch (e) {
    errors.push({
      path: "schemas/defs/",
      message: `Failed to load schema defs: ${e instanceof Error ? e.message : e}`,
    });
    return;
  }

  // Validate defs are valid JSON (already parsed by loadSchemaDefs, but check $id)
  const defsDir = join(schemasDir, "defs");
  if (existsSync(defsDir)) {
    for (const file of readdirSync(defsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = JSON.parse(readFileSync(join(defsDir, file), "utf-8"));
        if (!content.$id) {
          errors.push({
            path: `schemas/defs/${file}`,
            message: `Schema def missing $id field`,
          });
        }
      } catch (e) {
        errors.push({
          path: `schemas/defs/${file}`,
          message: `Invalid JSON: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  }

  // Try to compile all schemas with Ajv to verify $ref resolution
  try {
    const Ajv = require("ajv").default || require("ajv");
    const ajv = new Ajv({ allErrors: true });

    // Pre-load defs
    for (const def of defs) {
      try {
        ajv.addSchema(def);
      } catch (e) {
        const id = (def as any).$id || "unknown";
        errors.push({
          path: `schemas/defs/${id}`,
          message: `Failed to add schema def: ${e instanceof Error ? e.message : e}`,
        });
      }
    }

    // Compile input schemas
    const inputDir = join(schemasDir, "input");
    if (existsSync(inputDir)) {
      for (const file of readdirSync(inputDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const schema = JSON.parse(readFileSync(join(inputDir, file), "utf-8"));
          ajv.compile(schema);
        } catch (e) {
          errors.push({
            path: `schemas/input/${file}`,
            message: `Schema compilation failed: ${e instanceof Error ? e.message : e}`,
          });
        }
      }
    }

    // Compile output schemas
    const outputDir = join(schemasDir, "output");
    if (existsSync(outputDir)) {
      for (const file of readdirSync(outputDir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const schema = JSON.parse(readFileSync(join(outputDir, file), "utf-8"));
          ajv.compile(schema);
        } catch (e) {
          errors.push({
            path: `schemas/output/${file}`,
            message: `Schema compilation failed: ${e instanceof Error ? e.message : e}`,
          });
        }
      }
    }

    // Compile band-config schema if present
    const bandConfigPath = join(schemasDir, "band-config.schema.json");
    if (existsSync(bandConfigPath)) {
      try {
        const schema = JSON.parse(readFileSync(bandConfigPath, "utf-8"));
        ajv.compile(schema);
      } catch (e) {
        errors.push({
          path: "schemas/band-config.schema.json",
          message: `Schema compilation failed: ${e instanceof Error ? e.message : e}`,
        });
      }
    }
  } catch (e) {
    errors.push({
      path: "schemas/",
      message: `Ajv is required for schema validation but failed to load: ${e instanceof Error ? e.message : e}`,
    });
  }
}
