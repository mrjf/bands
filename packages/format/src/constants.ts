export const FRONTMATTER_DELIMITER = "---";

export const REQUIRED_FIELDS = ["band", "icon", "description"] as const;

export const IDENTITY_FIELDS = ["band", "icon", "description"] as const;

export const ALLOWED_TOP_LEVEL_KEYS = [
  "band",
  "icon",
  "description",
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
] as const;

export const EXECUTION_TARGETS = [
  "local-dangerously",
  "local-docker",
  "cloudflare",
] as const;

export const PERMISSION_CATEGORIES = [
  "tools",
  "skills",
  "mcps",
  "apis",
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
  extends: 3,
  includes: 4,
  allow: 5,
  deny: 6,
  insist: 7,
  limit: 8,
  env: 9,
  execution: 10,
  provides: 11,
  requires: 12,
};

export const ENV_FIELDS = ["secrets", "variables"] as const;

export const CANONICAL_CATEGORY_ORDER: Record<string, number> = {
  tools: 0,
  skills: 1,
  mcps: 2,
  apis: 3,
  read: 4,
  write: 5,
  cli: 6,
  net: 7,
};

export const LIMIT_FIELDS = [
  "maxInputBytes",
  "maxOutputBytes",
  "maxRuntimeMs",
  "maxCostDollars",
] as const;
