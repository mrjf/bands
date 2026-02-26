import { describe, test, expect } from "bun:test";
import { parseGitHubUrl, isValidGitHubUrl } from "../src/github-url";

describe("parseGitHubUrl", () => {
  test("parses simple owner/repo URL", () => {
    const result = parseGitHubUrl("https://github.com/acme/repo");
    expect(result).not.toBeNull();
    expect(result!.owner).toBe("acme");
    expect(result!.repo).toBe("repo");
    expect(result!.path).toBeUndefined();
    expect(result!.ref).toBeUndefined();
    expect(result!.pinned).toBe(false);
  });

  test("parses URL with tree/ref/path", () => {
    const result = parseGitHubUrl("https://github.com/acme/repo/tree/main/src/file.ts");
    expect(result).not.toBeNull();
    expect(result!.owner).toBe("acme");
    expect(result!.repo).toBe("repo");
    expect(result!.ref).toBe("main");
    expect(result!.path).toBe("src/file.ts");
    expect(result!.pinned).toBe(false);
  });

  test("detects pinned SHA", () => {
    const sha = "a".repeat(40);
    const result = parseGitHubUrl(`https://github.com/acme/repo@${sha}`);
    expect(result).not.toBeNull();
    expect(result!.ref).toBe(sha);
    expect(result!.pinned).toBe(true);
  });

  test("detects pinned semver tag", () => {
    const result = parseGitHubUrl("https://github.com/acme/repo@v1.2.3");
    expect(result).not.toBeNull();
    expect(result!.ref).toBe("v1.2.3");
    expect(result!.pinned).toBe(true);
  });

  test("unpinned branch ref", () => {
    const result = parseGitHubUrl("https://github.com/acme/repo/tree/main/path");
    expect(result!.pinned).toBe(false);
  });

  test("preserves fragment", () => {
    const result = parseGitHubUrl("https://github.com/acme/repo/tree/main/api#issues.*");
    expect(result).not.toBeNull();
    expect(result!.fragment).toBe("issues.*");
  });

  test("returns null for non-GitHub URL", () => {
    expect(parseGitHubUrl("https://example.com/foo")).toBeNull();
  });

  test("returns null for incomplete GitHub URL", () => {
    expect(parseGitHubUrl("https://github.com/acme")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseGitHubUrl("")).toBeNull();
  });
});

describe("isValidGitHubUrl", () => {
  test("valid URLs", () => {
    expect(isValidGitHubUrl("https://github.com/acme/repo")).toBe(true);
    expect(isValidGitHubUrl("https://github.com/acme/repo/tree/main/path")).toBe(true);
  });

  test("invalid URLs", () => {
    expect(isValidGitHubUrl("not-a-url")).toBe(false);
    expect(isValidGitHubUrl("https://example.com/foo")).toBe(false);
  });
});
