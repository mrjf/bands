import type {
  BandDocument,
  Conflict,
  EffectivePolicy,
  PermissionCategories,
} from "./types";
import { PERMISSION_CATEGORIES } from "./constants";

type PermCategory = keyof PermissionCategories;

/**
 * Detect conflicts per PRD §5.3:
 * - An insist item is denied (directly or via ceiling)
 * - An included band's requires.* cannot be satisfied under effective policy
 */
export function detectConflicts(
  self: BandDocument,
  ancestors: BandDocument[],
  included: BandDocument[],
  effective: EffectivePolicy
): Conflict[] {
  const conflicts: Conflict[] = [];

  // 1. Insist-deny conflicts: item appears in both effective insist sources and deny
  for (const category of PERMISSION_CATEGORIES) {
    const cat = category as PermCategory;
    const eff = (effective.capabilities as any)[cat];
    if (!eff) continue;

    // Collect raw insists from all sources before deny-wins
    const rawInsists = collectInsists(self, ancestors, included, cat);
    const denySet = new Set(eff.deny);

    for (const item of rawInsists) {
      if (denySet.has(item)) {
        conflicts.push({
          category: cat,
          item,
          type: "deny-insist",
          reason: `"${item}" is insisted but also denied`,
          sources: findSources(self, ancestors, included, cat, "insist", item),
        });
      }
    }

    // Ceiling-exceeded: an included band's allow item is not in ceiling
    for (const inc of included) {
      const incAllows = getAllows(inc, cat);
      for (const item of incAllows) {
        const inCeiling = eff.allow.includes(item) || eff.insist.includes(item);
        if (!inCeiling && !denySet.has(item)) {
          conflicts.push({
            category: cat,
            item,
            type: "ceiling-exceeded",
            reason: `"${item}" requested by included band "${inc.band}" exceeds ceiling`,
            sources: [inc.band],
          });
        }
      }
    }
  }

  // 2. Requires unsatisfied: included band declares requires.* that can't be met
  for (const inc of included) {
    if (inc.requires?.network?.egress) {
      for (const item of inc.requires.network.egress) {
        if (effective.capabilities.net.deny.includes(item)) {
          conflicts.push({
            category: "net",
            item,
            type: "requires-unsatisfied",
            reason: `Included band "${inc.band}" requires network egress "${item}" but it is denied`,
            sources: [inc.band],
          });
        }
      }
    }
  }

  return conflicts;
}

function collectInsists(
  self: BandDocument,
  ancestors: BandDocument[],
  included: BandDocument[],
  category: PermCategory
): string[] {
  const result: string[] = [];
  for (const doc of [...ancestors, self, ...included]) {
    result.push(...getColumnItems(doc, category, "insist"));
  }
  return result;
}

function getAllows(doc: BandDocument, category: PermCategory): string[] {
  return getColumnItems(doc, category, "allow");
}

function getColumnItems(
  doc: BandDocument,
  category: PermCategory,
  column: "allow" | "deny" | "insist"
): string[] {
  const permCol = doc[column];
  if (!permCol) return [];

  const arr = permCol[category];
  return (arr as string[] | undefined) ?? [];
}

function findSources(
  self: BandDocument,
  ancestors: BandDocument[],
  included: BandDocument[],
  category: PermCategory,
  column: "allow" | "deny" | "insist",
  item: string
): string[] {
  const sources: string[] = [];
  for (const doc of [...ancestors, self, ...included]) {
    const items = getColumnItems(doc, category, column);
    if (items.includes(item)) {
      sources.push(doc.band);
    }
  }
  return sources;
}
