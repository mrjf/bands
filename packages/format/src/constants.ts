export const FRONTMATTER_DELIMITER = "---";

export const REQUIRED_FIELDS = ["band", "icon", "description"] as const;

export const ALLOWED_TOP_LEVEL_KEYS = [
  "band",
  "icon",
  "description",
  "version",
  "url",
  "path",
  "extends",
  "includes",
  "allow",
  "deny",
  "insist",
  "limit",
  "env",
  "execution",
  "provides",
  "requires",
  "contract",
] as const;

export const EXECUTION_TARGETS = [
  "local-lima",
  "cloudflare",
] as const;

export const PERMISSION_CATEGORIES = [
  "read",
  "write",
  "cli",
  "net",
] as const;

export const PERMISSION_COLUMNS = ["allow", "deny", "insist"] as const;

/** Canonical key order for stable YAML output */
export const CANONICAL_KEY_ORDER: Record<string, number> = {
  icon: 0,
  band: 1,
  description: 2,
  version: 3,
  url: 4,
  path: 5,
  extends: 6,
  includes: 7,
  allow: 8,
  deny: 9,
  insist: 10,
  limit: 11,
  env: 12,
  execution: 13,
  provides: 14,
  requires: 15,
  contract: 16,
};

export const ENV_FIELDS = ["secrets", "variables"] as const;

export const CANONICAL_CATEGORY_ORDER: Record<string, number> = {
  read: 0,
  write: 1,
  cli: 2,
  net: 3,
};

export const LIMIT_FIELDS = [
  "maxInputBytes",
  "maxOutputBytes",
  "maxRuntimeMs",
  "maxCostDollars",
] as const;
