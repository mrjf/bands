import { describe, test, expect } from "bun:test";
import { computeEffective } from "../src/effective";
import type { BandDocument } from "../src/types";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return { band: "test",  icon: "🎵", ...overrides };
}

describe("computeEffective", () => {
  test("simple allow/deny/insist from self only", () => {
    const self = makeBand({
      allow: { read: ["path-a", "path-b"] },
      deny: { read: ["path-c"] },
      insist: { read: ["path-d"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.read.allow).toEqual(["path-a", "path-b"]);
    expect(result.capabilities.read.deny).toEqual(["path-c"]);
    expect(result.capabilities.read.insist).toEqual(["path-d"]);
  });

  test("deny wins over insist", () => {
    const self = makeBand({
      deny: { read: ["path-a"] },
      insist: { read: ["path-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.read.deny).toContain("path-a");
    expect(result.capabilities.read.insist).not.toContain("path-a");
  });

  test("deny wins over allow", () => {
    const self = makeBand({
      allow: { read: ["path-a"] },
      deny: { read: ["path-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.read.deny).toContain("path-a");
    expect(result.capabilities.read.allow).not.toContain("path-a");
  });

  test("insist items removed from allow", () => {
    const self = makeBand({
      allow: { read: ["path-a", "path-b"] },
      insist: { read: ["path-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.read.insist).toContain("path-a");
    expect(result.capabilities.read.allow).not.toContain("path-a");
    expect(result.capabilities.read.allow).toContain("path-b");
  });

  test("ceiling_allow: includes don't expand ceiling", () => {
    const self = makeBand({
      allow: { read: ["path-a"] },
    });
    const included = makeBand({
      band: "addon",
      allow: { read: ["path-a", "path-b"] },
    });
    const result = computeEffective(self, [], [included]);
    // path-b was requested by include but not in ceiling (self+extends only has path-a)
    expect(result.capabilities.read.allow).toContain("path-a");
    expect(result.capabilities.read.allow).not.toContain("path-b");
  });

  test("extends expand ceiling", () => {
    const parent = makeBand({
      band: "parent",
      allow: { read: ["path-a", "path-b"] },
    });
    const self = makeBand({
      allow: { read: ["path-a"] },
    });
    const result = computeEffective(self, [parent], []);
    expect(result.capabilities.read.allow).toContain("path-a");
    expect(result.capabilities.read.allow).toContain("path-b");
  });

  test("limits: most restrictive wins", () => {
    const parent = makeBand({
      band: "parent",
      limit: { maxInputBytes: 1000, maxRuntimeMs: 5000 },
    });
    const self = makeBand({
      limit: { maxInputBytes: 500, maxRuntimeMs: 10000 },
    });
    const result = computeEffective(self, [parent], []);
    expect(result.limits.maxInputBytes).toBe(500);
    expect(result.limits.maxRuntimeMs).toBe(5000);
  });

  test("no permissions returns empty sets", () => {
    const self = makeBand({});
    const result = computeEffective(self, [], []);
    expect(result.capabilities.read.allow).toEqual([]);
    expect(result.capabilities.read.deny).toEqual([]);
    expect(result.capabilities.read.insist).toEqual([]);
  });
});
