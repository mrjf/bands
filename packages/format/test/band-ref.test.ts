import { describe, expect, test } from "bun:test";
import {
  detectBandReference,
  resolveBandReference,
  isBandReference,
} from "../src/band-ref";
import { parseBandMd } from "../src/parse";

describe("detectBandReference", () => {
  test("detects url reference", () => {
    const ref = detectBandReference({
      url: "https://github.com/owner/repo/tree/main/bands/base",
    });
    expect(ref).not.toBeNull();
    expect(ref!.kind).toBe("url");
    expect(ref!.raw).toBe(
      "https://github.com/owner/repo/tree/main/bands/base"
    );
    expect(ref!.github).not.toBeUndefined();
    expect(ref!.github!.owner).toBe("owner");
    expect(ref!.github!.repo).toBe("repo");
  });

  test("detects path reference", () => {
    const ref = detectBandReference({ path: "../../shared/restricted.band.md" });
    expect(ref).not.toBeNull();
    expect(ref!.kind).toBe("path");
    expect(ref!.raw).toBe("../../shared/restricted.band.md");
    expect(ref!.github).toBeUndefined();
  });

  test("returns null for non-reference band", () => {
    const ref = detectBandReference({
      band: "my-band",
      icon: "🎵",
      description: "A band",
    });
    expect(ref).toBeNull();
  });

  test("returns null for empty url", () => {
    const ref = detectBandReference({ url: "" });
    expect(ref).toBeNull();
  });

  test("returns null for empty path", () => {
    const ref = detectBandReference({ path: "" });
    expect(ref).toBeNull();
  });

  test("url takes precedence over path", () => {
    const ref = detectBandReference({
      url: "https://github.com/owner/repo",
      path: "./local.band.md",
    });
    expect(ref).not.toBeNull();
    expect(ref!.kind).toBe("url");
  });

  test("handles non-GitHub url", () => {
    const ref = detectBandReference({
      url: "https://example.com/my-band.md",
    });
    expect(ref).not.toBeNull();
    expect(ref!.kind).toBe("url");
    expect(ref!.github).toBeUndefined();
  });
});

describe("resolveBandReference", () => {
  test("resolves url reference as-is", () => {
    const ref = {
      kind: "url" as const,
      raw: "https://github.com/owner/repo/tree/main/band",
    };
    const resolved = resolveBandReference(ref, "/some/base/path");
    expect(resolved).toBe(
      "https://github.com/owner/repo/tree/main/band"
    );
  });

  test("resolves relative path reference", () => {
    const ref = { kind: "path" as const, raw: "../shared/base.band.md" };
    const resolved = resolveBandReference(ref, "/project/skills/my-skill");
    expect(resolved).toBe("/project/skills/shared/base.band.md");
  });

  test("resolves absolute path reference", () => {
    const ref = { kind: "path" as const, raw: "/absolute/path/band.md" };
    const resolved = resolveBandReference(ref, "/some/other/dir");
    expect(resolved).toBe("/absolute/path/band.md");
  });
});

describe("isBandReference", () => {
  test("returns true for url reference", () => {
    expect(
      isBandReference({
        band: "",
        icon: "",
        description: "",
        url: "https://github.com/owner/repo",
      })
    ).toBe(true);
  });

  test("returns true for path reference", () => {
    expect(
      isBandReference({
        band: "",
        icon: "",
        description: "",
        path: "./other.band.md",
      })
    ).toBe(true);
  });

  test("returns false for normal band", () => {
    expect(
      isBandReference({
        band: "my-band",
        icon: "🎵",
        description: "test",
      })
    ).toBe(false);
  });
});

describe("parseBandMd with references", () => {
  test("parses url reference without required field warnings", () => {
    const result = parseBandMd(`---
url: https://github.com/owner/repo/tree/main/bands/base
---
`);
    expect(result.errors).toHaveLength(0);
    // Should NOT have warnings about missing band/icon/description
    const requiredWarnings = result.warnings.filter((w) =>
      w.message.includes("Required field")
    );
    expect(requiredWarnings).toHaveLength(0);
    expect(result.document.url).toBe(
      "https://github.com/owner/repo/tree/main/bands/base"
    );
  });

  test("parses path reference without required field warnings", () => {
    const result = parseBandMd(`---
path: ../../shared/restricted.band.md
---
`);
    expect(result.errors).toHaveLength(0);
    const requiredWarnings = result.warnings.filter((w) =>
      w.message.includes("Required field")
    );
    expect(requiredWarnings).toHaveLength(0);
    expect(result.document.path).toBe("../../shared/restricted.band.md");
  });
});
