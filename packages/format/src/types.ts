/** Execution target where the band runs */
export type ExecutionTarget = "local-dangerously" | "local-docker" | "cloudflare" | "lima";

/** Execution configuration */
export interface ExecutionConfig {
  /** Where the band should run */
  target: ExecutionTarget;

  /** Docker-specific configuration */
  docker?: {
    /** Docker image to use (default: node:20-slim or python:3.11-slim based on skill) */
    image?: string;
    /** Memory limit (e.g., "256m", "1g") */
    memory?: string;
    /** CPU limit (e.g., "0.5", "2") */
    cpus?: string;
    /** Network mode (default: none for isolation) */
    network?: "none" | "bridge" | "host";
    /** Additional volume mounts */
    volumes?: string[];
    /** Environment variables */
    env?: Record<string, string>;
  };

  /** Cloudflare-specific configuration */
  cloudflare?: {
    /** Worker name */
    workerName?: string;
    /** Account ID */
    accountId?: string;
    /** Custom domain */
    customDomain?: string;
  };
}

/** GitHub URL with optional pinning */
export interface GitHubUrl {
  raw: string;
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
  fragment?: string;
  pinned: boolean;
}

/** Skill reference: plain string or structured object */
export type SkillRef = string | SkillRefObject;

export interface SkillRefObject {
  kind: "github" | "local";
  ref: string;
}

/** Normalized skill ref always has structure */
export interface NormalizedSkillRef {
  kind: "github" | "local";
  ref: string;
}

/**
 * Category items for a permission column.
 *
 * All patterns use glob syntax for consistency:
 * - "*" matches any characters within a segment
 * - "**" matches any characters across segments (paths only)
 * - "?" matches a single character
 *
 * Permission model is DENY BY DEFAULT:
 * - If not in `allow`, it's denied
 * - `deny` punches holes in `allow` (e.g., allow "./data/**" but deny "**/.env*")
 * - `insist` requires child bands to also allow these items
 */
export interface PermissionCategories {
  /** Tools - GitHub URLs */
  tools?: string[];
  /** Skills - GitHub URLs or {kind, ref} objects */
  skills?: SkillRef[];
  /** MCP servers - GitHub URLs */
  mcps?: string[];
  /** APIs - GitHub URLs */
  apis?: string[];
  /** File read paths - glob patterns (e.g., "./data/**", "./config.json") */
  read?: string[];
  /** File write paths - glob patterns (e.g., "./output/**", "/tmp/**") */
  write?: string[];
  /** CLI commands - glob patterns (e.g., "jq *", "npm run *", "python scripts/*.py") */
  cli?: string[];
  /** Network hosts - glob patterns (e.g., "api.github.com", "*.npmjs.org") */
  net?: string[];
}

/** Limits section - values can be numbers or human-readable strings */
export interface Limits {
  /** Max input size (number in bytes, or string like "1k", "2m", "1g") */
  maxInputBytes?: number | string;
  /** Max output size (number in bytes, or string like "1k", "2m", "1g") */
  maxOutputBytes?: number | string;
  /** Max runtime (number in ms, or string like "100ms", "10s", "5m") */
  maxRuntimeMs?: number | string;
  /** Max cost in dollars */
  maxCostDollars?: number | string;
}

/**
 * Environment configuration for secrets and variables.
 * Values can be:
 * - "VAR_NAME" - fetch from running env or .env file
 * - "VAR_NAME=value" - use literal value
 * - "VAR_NAME<==OTHER_NAME" - rename from env/file
 */
export interface EnvConfig {
  /** Sensitive values (will be masked in logs) */
  secrets?: string[];
  /** Non-sensitive environment variables */
  variables?: string[];
}

/** Top-level permission structure */
export interface Permissions {
  allow?: PermissionCategories;
  deny?: PermissionCategories;
  insist?: PermissionCategories;
  limit?: Limits;
}

/** Adapter metadata */
export interface AdapterMetadata {
  provides?: {
    apis?: string[];
    tools?: string[];
    skills?: string[];
    mcps?: string[];
  };
  requires?: {
    secrets?: string[];
    network?: {
      egress?: string[];
    };
  };
}

/** Full Band document model (PRD §4) */
export interface BandDocument {
  // Identity (§4.2)
  band: string;
  icon: string;
  description: string;

  // Composition (§4.4)
  extends?: string[];
  includes?: string[];

  // Permissions - allow, deny, insist, limit
  allow?: PermissionCategories;
  deny?: PermissionCategories;
  insist?: PermissionCategories;
  limit?: Limits;

  // Environment - secrets and variables
  env?: EnvConfig;

  // Execution target (§4.10)
  execution?: ExecutionConfig;

  // Adapter metadata (§4.9)
  provides?: AdapterMetadata["provides"];
  requires?: AdapterMetadata["requires"];

  // Raw markdown body (not in frontmatter)
  body?: string;
}

/** Parse result */
export interface ParseResult {
  document: BandDocument;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  value?: unknown;
}

/** Loader function for resolving references */
export type BandLoader = (ref: string) => Promise<BandDocument | null>;

/** Effective capability set (computed) */
export interface EffectiveCapabilitySet {
  allow: string[];
  deny: string[];
  insist: string[];
}

/** Effective policy (computed from extends + self + includes) */
export interface EffectivePolicy {
  capabilities: {
    tools: EffectiveCapabilitySet;
    skills: EffectiveCapabilitySet;
    mcps: EffectiveCapabilitySet;
    apis: EffectiveCapabilitySet;
    fs: EffectiveCapabilitySet;
    cli: EffectiveCapabilitySet;
    net: EffectiveCapabilitySet;
  };
  limits: Limits;
}

/** Conflict (§5.3) */
export interface Conflict {
  category: string;
  item: string;
  type: "deny-insist" | "ceiling-exceeded" | "requires-unsatisfied";
  reason: string;
  sources: string[];
}

/** Fully resolved band */
export interface ResolvedBand {
  self: BandDocument;
  ancestors: BandDocument[];
  included: BandDocument[];
  effective: EffectivePolicy;
  conflicts: Conflict[];
}
