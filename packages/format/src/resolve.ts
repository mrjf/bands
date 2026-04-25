import type { BandDocument, BandLoader, ResolvedBand } from "./types";
import { computeEffective } from "./effective";
import { detectConflicts } from "./conflicts";

/**
 * Resolve a band's extends and includes chains via the provided loader.
 * Computes effective policy and detects conflicts.
 */
export async function resolve(
  band: BandDocument,
  loader: BandLoader,
  visited?: Set<string>
): Promise<ResolvedBand> {
  const seen = visited ?? new Set<string>();
  seen.add(band.band);

  // 1. Resolve extends chain (depth-first, root-first order)
  const ancestors: BandDocument[] = [];
  if (band.extends) {
    for (const ref of band.extends) {
      if (seen.has(ref)) continue; // cycle detection
      seen.add(ref);

      const parent = await loader(ref);
      if (!parent) {
        throw new Error(`Band "${band.band}" extends "${ref}" which could not be resolved`);
      }

      // Recursively resolve the parent
      const resolvedParent = await resolve(parent, loader, seen);
      // Add parent's ancestors (root-first), then parent itself
      ancestors.push(...resolvedParent.ancestors, resolvedParent.self);
    }
  }

  // 2. Resolve includes (single level — no recursive extends from includes)
  const included: BandDocument[] = [];
  if (band.includes) {
    for (const ref of band.includes) {
      if (seen.has(ref)) continue;
      seen.add(ref);

      const inc = await loader(ref);
      if (!inc) {
        throw new Error(`Band "${band.band}" includes "${ref}" which could not be resolved`);
      }
      included.push(inc);
    }
  }

  // 3. Compute effective policy
  const effective = computeEffective(band, ancestors, included);

  // 4. Detect conflicts
  const conflicts = detectConflicts(band, ancestors, included, effective);

  return {
    self: band,
    ancestors,
    included,
    effective,
    conflicts,
  };
}
