import type { Context } from "hono";
import { parseBandMd, validate, exportBandMd } from "@bands/format";
import { readdir } from "fs/promises";
import { join } from "path";

// Path to the bands package
const BANDS_DIR = join(import.meta.dir, "../../../bands");

// Path to the skills directory
const SKILLS_DIR = join(import.meta.dir, "../../../../skills");

export async function handleListBands(c: Context) {
  try {
    const entries = await readdir(BANDS_DIR, { withFileTypes: true });
    const bands = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules") continue;

      const bandMdPath = join(BANDS_DIR, entry.name, "BAND.md");
      const file = Bun.file(bandMdPath);

      if (await file.exists()) {
        const source = await file.text();
        const result = parseBandMd(source);
        bands.push(result.document);
      }
    }

    return c.json({ bands });
  } catch (e) {
    console.error("Failed to list bands:", e);
    return c.json({ bands: [], error: String(e) });
  }
}

export async function handleListSkills(c: Context) {
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = join(SKILLS_DIR, entry.name, "SKILL.md");
      const bandMdPath = join(SKILLS_DIR, entry.name, "BAND.md");

      const skillFile = Bun.file(skillMdPath);
      const bandFile = Bun.file(bandMdPath);

      if (!(await skillFile.exists()) || !(await bandFile.exists())) continue;

      const skillSource = await skillFile.text();
      const bandSource = await bandFile.text();

      // Parse SKILL.md frontmatter
      let name = entry.name;
      let description = "";
      let skillBody = skillSource;

      const trimmed = skillSource.trim();
      if (trimmed.startsWith("---")) {
        const afterFirst = trimmed.indexOf("\n", 3);
        if (afterFirst !== -1) {
          const closingIdx = trimmed.indexOf("\n---", afterFirst);
          if (closingIdx !== -1) {
            const yamlBlock = trimmed.slice(afterFirst + 1, closingIdx);
            // Extract name and description from simple YAML key: value lines
            for (const line of yamlBlock.split("\n")) {
              const match = line.match(/^(\w+):\s*(.*)/);
              if (match) {
                if (match[1] === "name") name = match[2].trim();
                if (match[1] === "description") description = match[2].trim();
              }
            }
            skillBody = trimmed.slice(closingIdx + 4).trim();
          }
        }
      }

      // Parse BAND.md
      const bandResult = parseBandMd(bandSource);

      skills.push({
        name,
        description,
        skillSource: skillBody,
        bandSource,
        band: bandResult.document,
      });
    }

    return c.json({ skills });
  } catch (e) {
    console.error("Failed to list skills:", e);
    return c.json({ skills: [], error: String(e) });
  }
}

export async function handleParse(c: Context) {
  const { source } = await c.req.json<{ source: string }>();
  const result = parseBandMd(source);
  return c.json(result);
}

export async function handleValidate(c: Context) {
  const doc = await c.req.json();
  const result = validate(doc);
  return c.json(result);
}

export async function handleExport(c: Context) {
  const doc = await c.req.json();
  const md = exportBandMd(doc);
  return c.text(md);
}
