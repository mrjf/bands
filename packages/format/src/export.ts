import { stringify } from "yaml";
import type { BandDocument } from "./types";
import { normalize, canonicalKeyComparator } from "./normalize";

/**
 * Export a BandDocument back to BAND.md format.
 * Normalizes the document first for stable, deterministic output.
 */
export function exportBandMd(doc: BandDocument): string {
  const normalized = normalize(doc);

  // Separate body and bandConfig from frontmatter data
  const { body, bandConfig, ...frontmatter } = normalized;

  // Remove undefined values and empty arrays
  const clean = removeEmpty(frontmatter) as Record<string, unknown>;

  // Re-emit bandConfig under the band name key
  if (bandConfig && normalized.band) {
    clean[normalized.band] = bandConfig;
  }

  const yamlStr = stringify(clean, {
    lineWidth: 0,  // Disable line wrapping to avoid quote toggling
    sortMapEntries: canonicalKeyComparator,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
    singleQuote: false,
    doubleQuotedAsJSON: false,
  });

  let output = `---\n${yamlStr}---\n`;

  if (body) {
    output += `\n${body}\n`;
  }

  return output;
}

function removeEmpty(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(removeEmpty);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      result[key] = removeEmpty(value);
    }
    return result;
  }
  return obj;
}
