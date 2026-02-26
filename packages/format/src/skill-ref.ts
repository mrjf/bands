import type { SkillRef, NormalizedSkillRef } from "./types";
import { isValidGitHubUrl } from "./github-url";

/**
 * Parse a SkillRef value into a normalized form.
 * - Plain string starting with https://github.com/ → kind: "github"
 * - Plain string otherwise (e.g. "./skills/foo") → kind: "local"
 * - Object with {kind, ref} → validate and return
 */
export function parseSkillRef(value: unknown): NormalizedSkillRef | null {
  if (typeof value === "string") {
    if (isValidGitHubUrl(value)) {
      return { kind: "github", ref: value };
    }
    return { kind: "local", ref: value };
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    "ref" in value
  ) {
    const obj = value as { kind: unknown; ref: unknown };
    if (
      (obj.kind === "github" || obj.kind === "local") &&
      typeof obj.ref === "string"
    ) {
      return { kind: obj.kind, ref: obj.ref };
    }
  }

  return null;
}

/** Normalize an array of SkillRef values, filtering out invalid ones */
export function normalizeSkillRef(refs: SkillRef[]): NormalizedSkillRef[] {
  const result: NormalizedSkillRef[] = [];
  for (const ref of refs) {
    const parsed = parseSkillRef(ref);
    if (parsed) result.push(parsed);
  }
  return result;
}
