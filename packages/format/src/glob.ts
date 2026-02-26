/**
 * Simple glob pattern matching for bands.
 *
 * Supports:
 * - "*" matches any characters except "/" (single segment)
 * - "**" matches any characters including "/" (multiple segments, paths only)
 * - "?" matches exactly one character
 *
 * Used for CLI commands, filesystem paths, and network hosts.
 */

/**
 * Convert a glob pattern to a RegExp.
 */
export function globToRegex(pattern: string, options: { matchSlash?: boolean } = {}): RegExp {
  const { matchSlash = false } = options;

  let regex = "";
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // "**" matches anything including slashes (non-greedy if followed by more pattern)
        // Skip any trailing slash after **
        if (pattern[i + 2] === "/") {
          regex += "(?:.*\\/)?";
          i += 3;
        } else {
          regex += ".*";
          i += 2;
        }
      } else {
        // "*" matches anything except slashes (unless matchSlash is true)
        regex += matchSlash ? ".*" : "[^/]*";
        i++;
      }
    } else if (char === "?") {
      // "?" matches exactly one character (not slash unless matchSlash)
      regex += matchSlash ? "." : "[^/]";
      i++;
    } else if ("\\^$.|+()[]{}".includes(char)) {
      // Escape regex special characters
      regex += "\\" + char;
      i++;
    } else {
      regex += char;
      i++;
    }
  }

  return new RegExp(`^${regex}$`);
}

/**
 * Test if a string matches a glob pattern.
 */
export function matchGlob(pattern: string, value: string, options: { matchSlash?: boolean } = {}): boolean {
  const regex = globToRegex(pattern, options);
  return regex.test(value);
}

/**
 * Test if a value matches any of the given glob patterns.
 */
export function matchAnyGlob(patterns: string[], value: string, options: { matchSlash?: boolean } = {}): boolean {
  return patterns.some(pattern => matchGlob(pattern, value, options));
}

/**
 * Check if a command is allowed by the given allow/deny patterns.
 * Deny patterns take precedence over allow patterns.
 *
 * @returns true if allowed, false if denied
 */
export function checkPermission(
  value: string,
  allow: string[] = [],
  deny: string[] = [],
  options: { matchSlash?: boolean } = {}
): boolean {
  // Deny takes precedence
  if (matchAnyGlob(deny, value, options)) {
    return false;
  }

  // Must match at least one allow pattern
  if (allow.length === 0) {
    return false;
  }

  return matchAnyGlob(allow, value, options);
}

/**
 * Check CLI command permission.
 * Commands are matched with matchSlash=true since commands can have paths.
 */
export function checkCliPermission(command: string, allow: string[] = [], deny: string[] = []): boolean {
  return checkPermission(command, allow, deny, { matchSlash: true });
}

/**
 * Check file read permission.
 * Paths use "**" for recursive matching.
 */
export function checkReadPermission(path: string, allow: string[] = [], deny: string[] = []): boolean {
  return checkPermission(path, allow, deny, { matchSlash: false });
}

/**
 * Check file write permission.
 * Paths use "**" for recursive matching.
 */
export function checkWritePermission(path: string, allow: string[] = [], deny: string[] = []): boolean {
  return checkPermission(path, allow, deny, { matchSlash: false });
}

/**
 * Check network host permission.
 * Hosts are simple domain matching.
 */
export function checkNetPermission(host: string, allow: string[] = [], deny: string[] = []): boolean {
  return checkPermission(host, allow, deny, { matchSlash: true });
}
