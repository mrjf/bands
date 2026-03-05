import { parse as yamlParse } from "yaml";
import type { BandDocument, ParseResult } from "./types";
import { validate } from "./validate";
import { FRONTMATTER_DELIMITER } from "./constants";

/**
 * Parse a BAND.md string into a BandDocument.
 * Extracts YAML frontmatter between --- delimiters and optional markdown body.
 */
export function parseBandMd(source: string): ParseResult {
  const trimmed = source.trim();

  // Must start with ---
  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return {
      document: {} as BandDocument,
      errors: [{ path: "", message: "Missing frontmatter: file must start with ---" }],
      warnings: [],
    };
  }

  // Find the closing ---
  const afterFirst = trimmed.indexOf("\n", FRONTMATTER_DELIMITER.length);
  if (afterFirst === -1) {
    return {
      document: {} as BandDocument,
      errors: [{ path: "", message: "Missing closing frontmatter delimiter ---" }],
      warnings: [],
    };
  }

  const closingIdx = trimmed.indexOf(
    `\n${FRONTMATTER_DELIMITER}`,
    afterFirst
  );
  if (closingIdx === -1) {
    return {
      document: {} as BandDocument,
      errors: [{ path: "", message: "Missing closing frontmatter delimiter ---" }],
      warnings: [],
    };
  }

  const yamlStr = trimmed.slice(afterFirst + 1, closingIdx);
  const bodyStart = closingIdx + 1 + FRONTMATTER_DELIMITER.length;
  const bodyRaw = trimmed.slice(bodyStart);
  const body = bodyRaw.trim() || undefined;

  let parsed: unknown;
  try {
    parsed = yamlParse(yamlStr);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid YAML";
    return {
      document: {} as BandDocument,
      errors: [{ path: "", message: `YAML parse error: ${msg}` }],
      warnings: [],
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      document: {} as BandDocument,
      errors: [{ path: "", message: "Frontmatter must be a YAML mapping" }],
      warnings: [],
    };
  }

  const raw = parsed as Record<string, unknown>;
  const doc = buildDocument(raw, body);
  const { errors, warnings } = validate(raw);

  return { document: doc, errors, warnings };
}

function buildDocument(
  raw: Record<string, unknown>,
  body?: string
): BandDocument {
  const doc: BandDocument = {
    band: String(raw.band ?? ""),
    icon: String(raw.icon ?? ""),
    description: String(raw.description ?? ""),
  };
  if (typeof raw.url === "string") {
    doc.url = raw.url;
  }
  if (typeof raw.path === "string") {
    doc.path = raw.path;
  }
  if (Array.isArray(raw.extends)) {
    doc.extends = raw.extends.map(String);
  }
  if (Array.isArray(raw.includes)) {
    doc.includes = raw.includes.map(String);
  }
  if (raw.allow && typeof raw.allow === "object") {
    doc.allow = raw.allow as BandDocument["allow"];
  }
  if (raw.deny && typeof raw.deny === "object") {
    doc.deny = raw.deny as BandDocument["deny"];
  }
  if (raw.insist && typeof raw.insist === "object") {
    doc.insist = raw.insist as BandDocument["insist"];
  }
  if (raw.limit && typeof raw.limit === "object") {
    doc.limit = raw.limit as BandDocument["limit"];
  }
  if (raw.env && typeof raw.env === "object") {
    doc.env = raw.env as BandDocument["env"];
  }
  if (raw.execution && typeof raw.execution === "object") {
    doc.execution = raw.execution as BandDocument["execution"];
  }
  if (raw.provides && typeof raw.provides === "object") {
    doc.provides = raw.provides as BandDocument["provides"];
  }
  if (raw.requires && typeof raw.requires === "object") {
    doc.requires = raw.requires as BandDocument["requires"];
  }
  if (raw.contract && typeof raw.contract === "object") {
    doc.contract = raw.contract as BandDocument["contract"];
  }
  if (body) {
    doc.body = body;
  }

  return doc;
}
