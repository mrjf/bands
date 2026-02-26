/**
 * Parse SKILL.md files into structured skill data
 */

import type { SkillFrontmatter } from "./types";

export interface ParsedSkillMd {
  frontmatter: SkillFrontmatter;
  instructions: string;
}

/**
 * Parse a SKILL.md file content into frontmatter and instructions.
 *
 * SKILL.md format:
 * ```
 * ---
 * name: skill-name
 * description: What it does
 * license: MIT
 * compatibility:
 *   systems: [macos, linux]
 *   network: true
 *   products: [claude-code]
 * allowed-tools: Bash, Read, Write
 * ---
 *
 * # Instructions
 *
 * Markdown content here...
 * ```
 */
export function parseSkillMd(content: string): ParsedSkillMd {
  const trimmed = content.trim();

  // Check for YAML frontmatter
  if (!trimmed.startsWith("---")) {
    throw new Error("SKILL.md must start with YAML frontmatter (---)");
  }

  // Find the closing ---
  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    throw new Error("SKILL.md frontmatter not closed (missing ---)");
  }

  const yamlContent = trimmed.slice(4, endIndex).trim();
  const instructions = trimmed.slice(endIndex + 4).trim();

  // Parse YAML frontmatter
  const frontmatter = parseYamlFrontmatter(yamlContent);

  // Validate required fields
  if (!frontmatter.name) {
    throw new Error("SKILL.md frontmatter must include 'name'");
  }
  if (!frontmatter.description) {
    throw new Error("SKILL.md frontmatter must include 'description'");
  }

  return { frontmatter, instructions };
}

/**
 * Simple YAML parser for skill frontmatter.
 * Handles the subset of YAML used in SKILL.md files.
 */
function parseYamlFrontmatter(yaml: string): SkillFrontmatter {
  // Use a mutable record to build up the result
  const result: Record<string, unknown> = {
    name: "",
    description: "",
  };

  const lines = yaml.split("\n");
  let currentKey: string | null = null;
  let currentIndent = 0;
  let nestedObject: Record<string, unknown> | null = null;
  let nestedKey: string | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const trimmedLine = line.trim();

    // Check if this is a nested property
    if (indent > 0 && nestedKey && nestedObject) {
      const match = trimmedLine.match(/^([a-z-]+):\s*(.*)$/i);
      if (match) {
        const [, key, value] = match;
        if (value.startsWith("[") && value.endsWith("]")) {
          // Inline array
          nestedObject[key] = parseInlineArray(value);
        } else if (value === "true" || value === "false") {
          nestedObject[key] = value === "true";
        } else {
          nestedObject[key] = value || undefined;
        }
      }
      continue;
    }

    // Top-level key
    const match = trimmedLine.match(/^([a-z-]+):\s*(.*)$/i);
    if (match) {
      const [, key, value] = match;

      // Save previous nested object
      if (nestedKey && nestedObject) {
        result[nestedKey] = nestedObject;
        nestedObject = null;
        nestedKey = null;
      }

      if (!value) {
        // Start of nested object
        nestedKey = key;
        nestedObject = {};
        currentIndent = indent;
      } else if (value.startsWith("[") && value.endsWith("]")) {
        // Inline array
        result[key] = parseInlineArray(value);
      } else if (value === "true" || value === "false") {
        result[key] = value === "true";
      } else {
        // Simple string value (remove quotes if present)
        result[key] = value.replace(/^["']|["']$/g, "");
      }

      currentKey = key;
    }
  }

  // Save final nested object
  if (nestedKey && nestedObject) {
    result[nestedKey] = nestedObject;
  }

  return result as unknown as SkillFrontmatter;
}

/**
 * Parse inline YAML array: [item1, item2, item3]
 */
function parseInlineArray(value: string): string[] {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];

  return inner.split(",").map((item) => {
    const trimmed = item.trim();
    // Remove quotes if present
    return trimmed.replace(/^["']|["']$/g, "");
  });
}
