/**
 * Band reference detection and resolution.
 *
 * A reference-only BAND.md delegates to another band via `url` or `path` fields.
 * - url: GitHub URL resolved via parseGitHubUrl()
 * - path: Relative file path resolved from the BAND.md file's directory
 */

import { resolve, dirname, join } from "path";
import { parseGitHubUrl, isValidGitHubUrl } from "./github-url";
import type { BandDocument, GitHubUrl } from "./types";

export interface BandReference {
  kind: "url" | "path";
  /** Raw value from the BAND.md field */
  raw: string;
  /** Parsed GitHub URL (only for url references) */
  github?: GitHubUrl;
}

/**
 * Detect whether a parsed band document is a reference-only band.
 * Returns the reference if found, or null if the band is a full definition.
 */
export function detectBandReference(
  raw: Record<string, unknown>
): BandReference | null {
  if (typeof raw.url === "string" && raw.url.length > 0) {
    const github = parseGitHubUrl(raw.url) ?? undefined;
    return { kind: "url", raw: raw.url, github };
  }

  if (typeof raw.path === "string" && raw.path.length > 0) {
    return { kind: "path", raw: raw.path };
  }

  return null;
}

/**
 * Resolve a band reference to an absolute path or URL.
 *
 * - URL references: returns the raw URL (caller is responsible for fetching)
 * - Path references: resolves relative to basePath (the directory containing the BAND.md)
 */
export function resolveBandReference(
  ref: BandReference,
  basePath: string
): string {
  if (ref.kind === "url") {
    return ref.raw;
  }

  // Path reference: resolve relative to basePath
  return resolve(basePath, ref.raw);
}

/**
 * Check if a BandDocument is a reference-only band.
 */
export function isBandReference(doc: BandDocument): boolean {
  return (
    (typeof doc.url === "string" && doc.url.length > 0) ||
    (typeof doc.path === "string" && doc.path.length > 0)
  );
}
