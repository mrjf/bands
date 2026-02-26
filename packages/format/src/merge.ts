/**
 * Set operations for policy merge.
 * All results are deduplicated and stably sorted.
 */

/** Union of multiple string arrays, deduplicated, stably sorted */
export function union(...arrays: string[][]): string[] {
  const set = new Set<string>();
  for (const arr of arrays) {
    for (const item of arr) {
      set.add(item);
    }
  }
  return [...set].sort();
}

/** Intersection of two string arrays, stably sorted */
export function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item)).sort();
}

/** Remove items in `toRemove` from `source`, stably sorted */
export function removeItems(source: string[], toRemove: string[]): string[] {
  const removeSet = new Set(toRemove);
  return source.filter((item) => !removeSet.has(item)).sort();
}
