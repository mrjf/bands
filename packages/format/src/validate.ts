import type { ValidationError, ValidationWarning } from "./types";
import {
  REQUIRED_FIELDS,
  ALLOWED_TOP_LEVEL_KEYS,
  PERMISSION_CATEGORIES,
  LIMIT_FIELDS,
} from "./constants";
import { isValidGitHubUrl } from "./github-url";
import { parseSkillRef } from "./skill-ref";

/** Validate band name is kebab-case */
function isValidBandName(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
}

/**
 * Validate a raw parsed object against the Band format spec.
 * Returns all errors and warnings (lenient: never blocks, just reports).
 */
export function validate(raw: Record<string, unknown>): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Pass 1: Required fields
  for (const field of REQUIRED_FIELDS) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === "") {
      warnings.push({
        path: field,
        message: `Required field "${field}" is missing`,
      });
    }
  }

  // Pass 2: Unknown top-level keys
  const allowedSet = new Set<string>(ALLOWED_TOP_LEVEL_KEYS as unknown as string[]);
  for (const key of Object.keys(raw)) {
    if (!allowedSet.has(key)) {
      warnings.push({
        path: key,
        message: `Unknown top-level key "${key}"`,
        value: raw[key],
      });
    }
  }

  // Pass 3: Type checks
  if (raw.band !== undefined && typeof raw.band !== "string") {
    errors.push({ path: "band", message: "band must be a string", value: raw.band });
  } else if (typeof raw.band === "string" && !isValidBandName(raw.band)) {
    errors.push({ path: "band", message: "band must be kebab-case (lowercase letters, numbers, and hyphens)", value: raw.band });
  }
  if (raw.icon !== undefined && typeof raw.icon !== "string") {
    errors.push({ path: "icon", message: "icon must be a string (emoji)", value: raw.icon });
  }
  if (raw.description !== undefined && typeof raw.description !== "string") {
    errors.push({ path: "description", message: "description must be a string", value: raw.description });
  }
  if (raw.extends !== undefined && !Array.isArray(raw.extends)) {
    errors.push({ path: "extends", message: "extends must be an array", value: raw.extends });
  }
  if (raw.includes !== undefined && !Array.isArray(raw.includes)) {
    errors.push({ path: "includes", message: "includes must be an array", value: raw.includes });
  }

  // Pass 4: Validate extends/includes items are GitHub URLs
  if (Array.isArray(raw.extends)) {
    for (let i = 0; i < raw.extends.length; i++) {
      const item = raw.extends[i];
      if (typeof item !== "string") {
        errors.push({ path: `extends[${i}]`, message: "extends item must be a string", value: item });
      } else if (!isValidGitHubUrl(item)) {
        warnings.push({ path: `extends[${i}]`, message: "extends item should be a GitHub URL", value: item });
      }
    }
  }
  if (Array.isArray(raw.includes)) {
    for (let i = 0; i < raw.includes.length; i++) {
      const item = raw.includes[i];
      if (typeof item !== "string") {
        errors.push({ path: `includes[${i}]`, message: "includes item must be a string", value: item });
      } else if (!isValidGitHubUrl(item)) {
        warnings.push({ path: `includes[${i}]`, message: "includes item should be a GitHub URL", value: item });
      }
    }
  }

  // Pass 5: Permission columns validation (allow, deny, insist)
  for (const col of ["allow", "deny", "insist"] as const) {
    if (raw[col] !== undefined) {
      if (typeof raw[col] !== "object" || raw[col] === null) {
        errors.push({ path: col, message: `${col} must be an object` });
      } else {
        validatePermissionCategories(raw[col] as Record<string, unknown>, col, errors, warnings);
      }
    }
  }

  // Pass 6: Limit validation
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== "object" || raw.limit === null) {
      errors.push({ path: "limit", message: "limit must be an object" });
    } else {
      const limit = raw.limit as Record<string, unknown>;
      const validFields = new Set<string>(LIMIT_FIELDS as unknown as string[]);
      for (const key of Object.keys(limit)) {
        if (!validFields.has(key)) {
          warnings.push({ path: `limit.${key}`, message: `Unknown limit field "${key}"` });
        }
        if (typeof limit[key] !== "number") {
          errors.push({ path: `limit.${key}`, message: `Limit "${key}" must be a number`, value: limit[key] });
        }
      }
    }
  }

  return { errors, warnings };
}

function validatePermissionCategories(
  obj: Record<string, unknown>,
  column: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const validCats = new Set<string>(PERMISSION_CATEGORIES as unknown as string[]);

  for (const key of Object.keys(obj)) {
    if (!validCats.has(key)) {
      warnings.push({
        path: `${column}.${key}`,
        message: `Unknown permission category "${key}"`,
      });
    }
  }

  // Validate tools, mcps, apis (GitHub URL items)
  for (const cat of ["tools", "mcps", "apis"] as const) {
    if (obj[cat] !== undefined) {
      if (!Array.isArray(obj[cat])) {
        errors.push({ path: `${column}.${cat}`, message: `${column}.${cat} must be an array` });
      } else {
        const arr = obj[cat] as unknown[];
        for (let i = 0; i < arr.length; i++) {
          if (typeof arr[i] !== "string") {
            errors.push({ path: `${column}.${cat}[${i}]`, message: `Item must be a string`, value: arr[i] });
          } else if (!isValidGitHubUrl(arr[i] as string)) {
            warnings.push({ path: `${column}.${cat}[${i}]`, message: `Item should be a GitHub URL`, value: arr[i] });
          }
        }
      }
    }
  }

  // Validate skills (SkillRef items)
  if (obj.skills !== undefined) {
    if (!Array.isArray(obj.skills)) {
      errors.push({ path: `${column}.skills`, message: `${column}.skills must be an array` });
    } else {
      const arr = obj.skills as unknown[];
      for (let i = 0; i < arr.length; i++) {
        const parsed = parseSkillRef(arr[i]);
        if (!parsed) {
          warnings.push({
            path: `${column}.skills[${i}]`,
            message: "Invalid skill reference",
            value: arr[i],
          });
        }
      }
    }
  }

  // Validate fs, cli, net (string arrays)
  for (const cat of ["fs", "cli", "net"] as const) {
    if (obj[cat] !== undefined) {
      if (!Array.isArray(obj[cat])) {
        errors.push({ path: `${column}.${cat}`, message: `${column}.${cat} must be an array` });
      } else {
        const arr = obj[cat] as unknown[];
        for (let i = 0; i < arr.length; i++) {
          if (typeof arr[i] !== "string") {
            errors.push({ path: `${column}.${cat}[${i}]`, message: `Item must be a string`, value: arr[i] });
          }
        }
      }
    }
  }
}
