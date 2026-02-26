import { stringify } from "yaml";
import type { BandDocument } from "./types";
import { normalize, canonicalKeyComparator } from "./normalize";

/**
 * Export a BandDocument back to BAND.md format.
 * Normalizes the document first for stable, deterministic output.
 */
export function exportBandMd(doc: BandDocument): string {
  const normalized = normalize(doc);

  // Separate body from frontmatter data
  const { body, ...frontmatter } = normalized;

  // Remove undefined values and empty arrays
  const clean = removeEmpty(frontmatter);

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
