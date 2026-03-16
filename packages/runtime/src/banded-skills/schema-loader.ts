/**
 * Schema loader for centralized skill schemas.
 *
 * Skills store schemas in a centralized `schemas/` directory:
 *   schemas/defs/*.json     — shared fragment definitions ($id-based)
 *   schemas/input/<name>.json  — per-script input schemas
 *   schemas/output/<name>.json — per-script output schemas
 *   schemas/band-config.schema.json — optional bandConfig schema
 *
 * All defs are pre-loaded into Ajv via addSchema(), then schemas
 * reference them by $id (e.g. {"$ref": "defs/repo.json"}).
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type Ajv from "ajv";

export interface LoadedSchemas {
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

/**
 * Load input and output schemas for a script from the centralized schemas/ dir.
 */
export function loadSchemas(
  skillRoot: string,
  scriptName: string
): LoadedSchemas {
  const result: LoadedSchemas = {};

  const inputPath = join(skillRoot, "schemas", "input", `${scriptName}.json`);
  const outputPath = join(skillRoot, "schemas", "output", `${scriptName}.json`);

  if (existsSync(inputPath)) {
    result.input = JSON.parse(readFileSync(inputPath, "utf-8"));
  }

  if (existsSync(outputPath)) {
    result.output = JSON.parse(readFileSync(outputPath, "utf-8"));
  }

  return result;
}

/**
 * Load all schema defs from schemas/defs/*.json.
 * Returns an array of parsed JSON objects ready for ajv.addSchema().
 */
export function loadSchemaDefs(skillRoot: string): Record<string, unknown>[] {
  const defsDir = join(skillRoot, "schemas", "defs");
  if (!existsSync(defsDir)) {
    return [];
  }

  const defs: Record<string, unknown>[] = [];
  for (const file of readdirSync(defsDir)) {
    if (!file.endsWith(".json")) continue;
    const content = readFileSync(join(defsDir, file), "utf-8");
    defs.push(JSON.parse(content));
  }

  return defs;
}

/**
 * Load the band-config schema if present.
 */
export function loadBandConfigSchema(
  skillRoot: string
): Record<string, unknown> | null {
  const schemaPath = join(skillRoot, "schemas", "band-config.schema.json");
  if (!existsSync(schemaPath)) {
    return null;
  }
  return JSON.parse(readFileSync(schemaPath, "utf-8"));
}

// Cache validators per skill root to avoid re-creating Ajv instances
const validatorCache = new Map<string, Ajv>();

/**
 * Create an Ajv validator instance pre-loaded with all defs for a skill.
 * Cached per skillRoot.
 */
export async function createValidator(skillRoot: string): Promise<Ajv> {
  const cached = validatorCache.get(skillRoot);
  if (cached) return cached;

  const AjvModule = await import("ajv");
  const Ajv = AjvModule.default;
  const ajv = new Ajv({ allErrors: true });

  // Pre-load all defs so $ref works
  const defs = loadSchemaDefs(skillRoot);
  for (const def of defs) {
    ajv.addSchema(def);
  }

  validatorCache.set(skillRoot, ajv);
  return ajv;
}

/**
 * Clear the validator cache (useful for testing).
 */
export function clearValidatorCache(): void {
  validatorCache.clear();
}
