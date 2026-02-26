import type { Context } from "hono";
import { parseBandMd, validate, exportBandMd } from "@bands/format";
import { readdir } from "fs/promises";
import { join } from "path";

// Path to the bands package
const BANDS_DIR = join(import.meta.dir, "../../../bands");

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
