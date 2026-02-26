import type {
  BandDocument,
  EffectivePolicy,
  EffectiveCapabilitySet,
  Limits,
  PermissionCategories,
} from "./types";
import { PERMISSION_CATEGORIES, LIMIT_FIELDS } from "./constants";
import { union, intersect, removeItems } from "./merge";

type PermCategory = keyof PermissionCategories;

/**
 * Compute the effective policy from extends chain + self + includes.
 * Implements PRD §5.2:
 *
 * effective_deny   = union(denies from extends + self + includes)
 * effective_insist  = union(insists from extends + self + includes)
 * requested_allow  = union(allows from extends + self + includes)
 * ceiling_allow    = union(allows from extends + self) — includes don't expand ceiling
 * effective_allow  = (requested_allow ∩ ceiling_allow) - effective_deny
 *
 * Priority: deny > insist > allow > default
 */
export function computeEffective(
  self: BandDocument,
  ancestors: BandDocument[],
  included: BandDocument[]
): EffectivePolicy {
  const capabilities = {} as EffectivePolicy["capabilities"];

  for (const category of PERMISSION_CATEGORIES) {
    const cat = category as PermCategory;

    const extendsDenies = collectField(ancestors, cat, "deny");
    const selfDenies = getField(self, cat, "deny");
    const includesDenies = collectField(included, cat, "deny");

    const extendsInsists = collectField(ancestors, cat, "insist");
    const selfInsists = getField(self, cat, "insist");
    const includesInsists = collectField(included, cat, "insist");

    const extendsAllows = collectField(ancestors, cat, "allow");
    const selfAllows = getField(self, cat, "allow");
    const includesAllows = collectField(included, cat, "allow");

    const effective_deny = union(extendsDenies, selfDenies, includesDenies);
    const effective_insist_raw = union(extendsInsists, selfInsists, includesInsists);
    const requested_allow = union(extendsAllows, selfAllows, includesAllows);
    const ceiling_allow = union(extendsAllows, selfAllows); // includes don't expand ceiling

    // effective_allow = (requested ∩ ceiling) - deny
    const effective_allow = removeItems(
      intersect(requested_allow, ceiling_allow),
      effective_deny
    );

    // deny > insist: remove denied items from insist
    const effective_insist = removeItems(effective_insist_raw, effective_deny);

    // Remove insisted items from allow (they're promoted to insist)
    const final_allow = removeItems(effective_allow, effective_insist);

    (capabilities as any)[cat] = {
      deny: effective_deny,
      insist: effective_insist,
      allow: final_allow,
    };
  }

  // Limits: most restrictive wins (minimum value across chain)
  const limits = computeEffectiveLimits(self, ancestors, included);

  return { capabilities, limits };
}

function getField(doc: BandDocument, category: PermCategory, column: "allow" | "deny" | "insist"): string[] {
  const permCol = doc[column];
  if (!permCol) return [];

  if (category === "skills") {
    const arr = permCol.skills;
    if (!arr) return [];
    return arr.map((item) => (typeof item === "string" ? item : item.ref));
  }

  const arr = permCol[category];
  return (arr as string[] | undefined) ?? [];
}

function collectField(docs: BandDocument[], category: PermCategory, column: "allow" | "deny" | "insist"): string[] {
  const result: string[] = [];
  for (const doc of docs) {
    result.push(...getField(doc, category, column));
  }
  return result;
}

function computeEffectiveLimits(
  self: BandDocument,
  ancestors: BandDocument[],
  included: BandDocument[]
): Limits {
  const result: Limits = {};
  const allDocs = [...ancestors, self, ...included];

  for (const field of LIMIT_FIELDS) {
    let min: number | undefined;
    for (const doc of allDocs) {
      const val = doc.limit?.[field];
      if (val !== undefined) {
        min = min === undefined ? val : Math.min(min, val);
      }
    }
    if (min !== undefined) {
      result[field] = min;
    }
  }

  return result;
}
