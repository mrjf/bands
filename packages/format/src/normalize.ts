import type { BandDocument, PermissionCategories } from "./types";
import {
  CANONICAL_KEY_ORDER,
  CANONICAL_CATEGORY_ORDER,
} from "./constants";

/**
 * Normalize a BandDocument for stable output:
 * - Top-level keys in canonical order
 * - Permission categories in canonical order
 * - Array items sorted alphabetically
 * - Deep-cloned to avoid mutation
 */
export function normalize(doc: BandDocument): BandDocument {
  const clone = structuredClone(doc);

  // Sort array fields
  if (clone.extends) clone.extends = [...clone.extends].sort();
  if (clone.includes) clone.includes = [...clone.includes].sort();

  // Sort permission category arrays
  for (const col of ["allow", "deny", "insist"] as const) {
    if (clone[col]) {
      sortPermissionCategories(clone[col]!);
    }
  }

  return clone;
}

function sortPermissionCategories(cats: PermissionCategories): void {
  for (const key of Object.keys(cats) as (keyof PermissionCategories)[]) {
    const arr = cats[key];
    if (Array.isArray(arr)) {
      (cats[key] as unknown[]) = [...arr].sort((a, b) => {
        const sa = typeof a === "string" ? a : JSON.stringify(a);
        const sb = typeof b === "string" ? b : JSON.stringify(b);
        return sa.localeCompare(sb);
      });
    }
  }
}

/**
 * Sort map entries comparator for YAML stringify.
 * Ensures canonical key ordering at the top level and within categories.
 */
export function canonicalKeyComparator(a: { key: unknown }, b: { key: unknown }): number {
  const ka = String(a.key);
  const kb = String(b.key);

  // Check top-level canonical order
  const oa = CANONICAL_KEY_ORDER[ka];
  const ob = CANONICAL_KEY_ORDER[kb];
  if (oa !== undefined && ob !== undefined) return oa - ob;
  if (oa !== undefined) return -1;
  if (ob !== undefined) return 1;

  // Check category order
  const ca = CANONICAL_CATEGORY_ORDER[ka];
  const cb = CANONICAL_CATEGORY_ORDER[kb];
  if (ca !== undefined && cb !== undefined) return ca - cb;
  if (ca !== undefined) return -1;
  if (cb !== undefined) return 1;

  return ka.localeCompare(kb);
}
