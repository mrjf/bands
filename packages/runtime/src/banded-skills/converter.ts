/**
 * Banded skill converter.
 *
 * Converts existing skills (loaded via fetchSkill()) into the banded skill
 * directory structure with per-script sandboxing.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { exportBandMd, type BandDocument } from "@bands/format";
import { fetchSkill } from "../skills/fetcher";
import {
  generateWrapper,
  generateSparseSKILLMd,
  generatePerScriptBand,
} from "./generator";
import { validateBandedSkill } from "./validator";
import type { BandedSkillValidationResult } from "./types";

export interface ConvertOptions {
  /** Don't write files, just show what would be created */
  dryRun?: boolean;
  /** Print detailed output */
  verbose?: boolean;
}

export interface ConvertResult {
  /** Whether conversion succeeded */
  success: boolean;
  /** Files that were (or would be) created */
  files: string[];
  /** Validation result of the generated skill */
  validation?: BandedSkillValidationResult;
  /** Error message if failed */
  error?: string;
}

/**
 * Convert an existing skill to the banded skill directory structure.
 *
 * 1. Fetch & parse existing skill
 * 2. For each script: analyze content for CLI commands, file patterns, network hosts
 * 3. Generate per-script BAND.md with minimal permissions
 * 4. Generate input/output schema stubs
 * 5. Generate wrappers and sparse SKILL.md
 * 6. Run validateBandedSkill() on result
 */
export async function convertToBandedSkill(
  source: string,
  outputDir: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const { dryRun = false, verbose = false } = options;
  const files: string[] = [];

  try {
    // 1. Fetch existing skill
    if (verbose) console.log(`Fetching skill from ${source}...`);
    const skill = await fetchSkill(source);

    if (verbose) {
      console.log(`  Name: ${skill.frontmatter.name}`);
      console.log(`  Scripts: ${[...skill.scripts.keys()].join(", ") || "none"}`);
    }

    // Collect script names
    const scriptNames = [...skill.scripts.keys()].map((f) =>
      f.replace(/\.(sh|py|js|ts)$/, "")
    );

    // If no scripts found, create a default one
    if (scriptNames.length === 0) {
      scriptNames.push("run");
    }

    // Ensure output directory structure
    const dirs = [
      outputDir,
      join(outputDir, "scripts"),
      join(outputDir, "scripts", "resources"),
    ];
    for (const name of scriptNames) {
      dirs.push(join(outputDir, "scripts", "resources", name));
    }

    if (!dryRun) {
      for (const dir of dirs) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // 2. Generate SKILL.md
    const skillMd = generateSparseSKILLMd(
      skill.frontmatter.name,
      skill.frontmatter.description,
      scriptNames
    );
    const skillMdPath = join(outputDir, "SKILL.md");
    files.push(skillMdPath);
    if (!dryRun) {
      writeFileSync(skillMdPath, skillMd);
    }

    // 3. Generate top-level BAND.md with broad permissions
    const topBand: BandDocument = {
      band: skill.frontmatter.name,
      icon: "\u{1F527}",
      description: skill.frontmatter.description,
      execution: {
        target: "local-dangerously",
      },
      allow: {
        cli: ["*"],
        read: ["**/*"],
        write: ["**/*"],
      },
    };
    const topBandPath = join(outputDir, "BAND.md");
    files.push(topBandPath);
    if (!dryRun) {
      writeFileSync(topBandPath, exportBandMd(topBand));
    }

    // 4. Generate per-script files
    for (const scriptName of scriptNames) {
      const resourceDir = join(outputDir, "scripts", "resources", scriptName);

      // Get script content (if we have it)
      const originalFilename = [...skill.scripts.keys()].find((k) =>
        k.startsWith(scriptName)
      );
      const scriptContent = originalFilename
        ? skill.scripts.get(originalFilename)?.content ?? ""
        : "";

      // Generate run.sh
      const runShPath = join(resourceDir, "run.sh");
      files.push(runShPath);
      if (!dryRun) {
        const runSh = scriptContent || `#!/bin/bash\n# TODO: Implement ${scriptName}\necho '{"error": "not implemented"}'\n`;
        writeFileSync(runShPath, runSh, { mode: 0o755 });
      }

      // Generate per-script BAND.md
      const perBand = generatePerScriptBand(scriptName, scriptContent);
      const perBandPath = join(resourceDir, "BAND.md");
      files.push(perBandPath);
      if (!dryRun) {
        writeFileSync(perBandPath, exportBandMd(perBand));
      }

      // Generate input schema stub
      const inputSchemaPath = join(resourceDir, "input_schema.json");
      files.push(inputSchemaPath);
      if (!dryRun) {
        const inputSchema = {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: `Input for ${scriptName}`,
            },
          },
        };
        writeFileSync(inputSchemaPath, JSON.stringify(inputSchema, null, 2) + "\n");
      }

      // Generate output schema stub
      const outputSchemaPath = join(resourceDir, "output_schema.json");
      files.push(outputSchemaPath);
      if (!dryRun) {
        const outputSchema = {
          type: "object",
          properties: {
            result: {
              type: "string",
              description: `Result from ${scriptName}`,
            },
          },
        };
        writeFileSync(outputSchemaPath, JSON.stringify(outputSchema, null, 2) + "\n");
      }

      // Generate wrapper script
      const wrapperPath = join(outputDir, "scripts", scriptName);
      files.push(wrapperPath);
      if (!dryRun) {
        writeFileSync(wrapperPath, generateWrapper(scriptName), {
          mode: 0o755,
        });
      }
    }

    // 5. Validate the result
    let validation: BandedSkillValidationResult | undefined;
    if (!dryRun) {
      validation = validateBandedSkill(outputDir);
      if (verbose) {
        if (validation.valid) {
          console.log("\nGenerated skill passes validation");
        } else {
          console.log("\nGenerated skill has validation issues:");
          for (const err of validation.errors) {
            console.log(`  ✗ ${err.path}: ${err.message}`);
          }
        }
      }
    }

    return { success: true, files, validation };
  } catch (e) {
    return {
      success: false,
      files,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
