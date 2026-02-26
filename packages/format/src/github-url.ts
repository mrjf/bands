import type { GitHubUrl } from "./types";

const GITHUB_HOST = "https://github.com/";
const SHA_RE = /^[0-9a-f]{40}$/;
const SEMVER_RE = /^v?\d+\.\d+\.\d+/;

/**
 * Parse a GitHub URL into structured parts.
 * Accepts: https://github.com/{owner}/{repo}[/tree|blob/{ref}/{path}][@sha]
 * Fragment (#...) is preserved separately.
 */
export function parseGitHubUrl(raw: string): GitHubUrl | null {
  if (!raw.startsWith(GITHUB_HOST)) return null;

  let url = raw;
  let fragment: string | undefined;

  const hashIdx = url.indexOf("#");
  if (hashIdx !== -1) {
    fragment = url.slice(hashIdx + 1);
    url = url.slice(0, hashIdx);
  }

  // Check for @sha pinning at end
  let pinnedRef: string | undefined;
  const atIdx = url.lastIndexOf("@");
  if (atIdx > GITHUB_HOST.length) {
    pinnedRef = url.slice(atIdx + 1);
    url = url.slice(0, atIdx);
  }

  const rest = url.slice(GITHUB_HOST.length);
  const parts = rest.split("/").filter(Boolean);

  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];

  let path: string | undefined;
  let ref: string | undefined;

  if (parts.length > 2) {
    // Could be /tree/{ref}/{path...} or /blob/{ref}/{path...} or just /{path...}
    const kind = parts[2]; // "tree", "blob", or a path segment
    if ((kind === "tree" || kind === "blob") && parts.length > 3) {
      ref = parts[3];
      if (parts.length > 4) {
        path = parts.slice(4).join("/");
      }
    } else {
      path = parts.slice(2).join("/");
    }
  }

  if (pinnedRef) {
    ref = pinnedRef;
  }

  const pinned = ref ? SHA_RE.test(ref) || SEMVER_RE.test(ref) : false;

  return { raw, owner, repo, path, ref, fragment, pinned };
}

/** Check if a string is a valid GitHub URL shape */
export function isValidGitHubUrl(url: string): boolean {
  return parseGitHubUrl(url) !== null;
}
