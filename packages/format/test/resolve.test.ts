import { describe, test, expect } from "bun:test";
import { resolve } from "../src/resolve";
import type { BandDocument, BandLoader } from "../src/types";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return { band: "test",  icon: "🎵", ...overrides };
}

describe("resolve", () => {
  test("resolves band with no extends or includes", async () => {
    const self = makeBand({ band: "solo" });
    const loader: BandLoader = async () => null;
    const result = await resolve(self, loader);
    expect(result.self.band).toBe("solo");
    expect(result.ancestors).toHaveLength(0);
    expect(result.included).toHaveLength(0);
  });

  test("resolves single-level extends", async () => {
    const parent = makeBand({
      band: "parent",
      allow: { read: ["path-a", "path-b"] },
    });
    const self = makeBand({
      band: "child",
      extends: ["parent"],
      allow: { read: ["path-a"] },
    });
    const loader: BandLoader = async (ref) => (ref === "parent" ? parent : null);
    const result = await resolve(self, loader);
    expect(result.ancestors).toHaveLength(1);
    expect(result.ancestors[0].band).toBe("parent");
  });

  test("resolves multi-level extends chain", async () => {
    const grandparent = makeBand({ band: "grandparent" });
    const parent = makeBand({ band: "parent", extends: ["grandparent"] });
    const self = makeBand({ band: "child", extends: ["parent"] });

    const bands: Record<string, BandDocument> = { grandparent, parent };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(self, loader);
    expect(result.ancestors).toHaveLength(2);
    expect(result.ancestors[0].band).toBe("grandparent");
    expect(result.ancestors[1].band).toBe("parent");
  });

  test("resolves includes", async () => {
    const addon = makeBand({
      band: "addon",
      allow: { read: ["path-x"] },
    });
    const self = makeBand({
      band: "main",
      includes: ["addon"],
      allow: { read: ["path-a"] },
    });
    const loader: BandLoader = async (ref) => (ref === "addon" ? addon : null);
    const result = await resolve(self, loader);
    expect(result.included).toHaveLength(1);
    expect(result.included[0].band).toBe("addon");
  });

  test("detects and skips cycles", async () => {
    const a = makeBand({ band: "a", extends: ["b"] });
    const b = makeBand({ band: "b", extends: ["a"] });

    const bands: Record<string, BandDocument> = { a, b };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(a, loader);
    // Should not infinite loop; b tries to extend a but a is already visited
    expect(result.ancestors.length).toBeLessThanOrEqual(1);
  });

  test("errors on unresolvable extends reference", async () => {
    const self = makeBand({
      band: "main",
      extends: ["nonexistent"],
    });
    const loader: BandLoader = async () => null;
    expect(resolve(self, loader)).rejects.toThrow('extends "nonexistent" which could not be resolved');
  });

  test("errors on unresolvable includes reference", async () => {
    const self = makeBand({
      band: "main",
      includes: ["nonexistent"],
    });
    const loader: BandLoader = async () => null;
    expect(resolve(self, loader)).rejects.toThrow('includes "nonexistent" which could not be resolved');
  });

  test("computes effective policy through resolution", async () => {
    const parent = makeBand({
      band: "parent",
      allow: { read: ["path-a", "path-b"] },
      deny: { read: ["path-c"] },
    });
    const self = makeBand({
      band: "child",
      extends: ["parent"],
      allow: { read: ["path-a"] },
      insist: { read: ["path-d"] },
    });
    const loader: BandLoader = async (ref) => (ref === "parent" ? parent : null);
    const result = await resolve(self, loader);
    expect(result.effective.capabilities.read.allow).toContain("path-a");
    expect(result.effective.capabilities.read.allow).toContain("path-b");
    expect(result.effective.capabilities.read.deny).toContain("path-c");
    expect(result.effective.capabilities.read.insist).toContain("path-d");
  });
});
