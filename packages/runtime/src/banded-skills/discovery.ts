/**
 * Band discovery for banded skills.
 *
 * Resolution order (most-specific wins entirely):
 *   scripts/resources/<name>/BAND.md > scripts/BAND.md > top-level BAND.md
 *
 * BAND.md files can be:
 * - Full band definitions (with frontmatter)
 * - Reference-only (url: or path: pointing to another BAND.md)
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import {
  parseBandMd,
  detectBandReference,
  resolveBandReference,
  isBandReference,
  type BandDocument,
  type BandReference,
} from "@bands/format";
import type { BandedScript } from "./types";

export interface DiscoveryResult {
  band: BandDocument;
  source: "per-script" | "scripts-level" | "top-level";
}

/**
 * Discover the BAND.md that applies to a given script.
 *
 * Checks in order (most-specific wins):
 * 1. scripts/resources/<scriptName>/BAND.md
 * 2. scripts/BAND.md
 * 3. Top-level BAND.md
 *
 * If the discovered BAND.md is a reference (url: or path:), it resolves the reference.
 */
export function discoverBandForScript(
  skillRoot: string,
  scriptName: string
): DiscoveryResult | null {
  // 1. Per-script BAND.md
  const perScriptPath = join(
    skillRoot,
    "scripts",
    "resources",
    scriptName,
    "BAND.md"
  );
  if (existsSync(perScriptPath)) {
    const band = loadAndResolveBand(perScriptPath);
    if (band) {
      return { band, source: "per-script" };
    }
  }

  // 2. Scripts-level BAND.md
  const scriptsLevelPath = join(skillRoot, "scripts", "BAND.md");
  if (existsSync(scriptsLevelPath)) {
    const band = loadAndResolveBand(scriptsLevelPath);
    if (band) {
      return { band, source: "scripts-level" };
    }
  }

  // 3. Top-level BAND.md
  const topLevelPath = join(skillRoot, "BAND.md");
  if (existsSync(topLevelPath)) {
    const band = loadAndResolveBand(topLevelPath);
    if (band) {
      return { band, source: "top-level" };
    }
  }

  return null;
}

/**
 * Load a BAND.md file, resolving path references if needed.
 * URL references are returned as-is (the document will have the url field set).
 */
function loadAndResolveBand(bandPath: string): BandDocument | null {
  const content = readFileSync(bandPath, "utf-8");
  const result = parseBandMd(content);

  if (result.errors.length > 0) {
    return null;
  }

  const doc = result.document;

  // Check for path reference — resolve and load the target
  if (doc.path) {
    const resolvedPath = resolveBandReference(
      { kind: "path", raw: doc.path },
      dirname(bandPath)
    );

    if (!existsSync(resolvedPath)) {
      return null;
    }

    return loadAndResolveBand(resolvedPath);
  }

  // URL references are returned as-is (caller handles fetching)
  return doc;
}
