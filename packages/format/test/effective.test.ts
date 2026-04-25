import { describe, test, expect } from "bun:test";
import { computeEffective } from "../src/effective";
import type { BandDocument } from "../src/types";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return { band: "test",  icon: "🎵", ...overrides };
}

describe("computeEffective", () => {
  test("simple allow/deny/insist from self only", () => {
    const self = makeBand({
      allow: { cli: ["cmd-a", "cmd-b"] },
      deny: { cli: ["cmd-c"] },
      insist: { cli: ["cmd-d"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.cli.allow).toEqual(["cmd-a", "cmd-b"]);
    expect(result.capabilities.cli.deny).toEqual(["cmd-c"]);
    expect(result.capabilities.cli.insist).toEqual(["cmd-d"]);
  });

  test("deny wins over insist", () => {
    const self = makeBand({
      deny: { cli: ["cmd-a"] },
      insist: { cli: ["cmd-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.cli.deny).toContain("cmd-a");
    expect(result.capabilities.cli.insist).not.toContain("cmd-a");
  });

  test("deny wins over allow", () => {
    const self = makeBand({
      allow: { cli: ["cmd-a"] },
      deny: { cli: ["cmd-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.cli.deny).toContain("cmd-a");
    expect(result.capabilities.cli.allow).not.toContain("cmd-a");
  });

  test("insist items removed from allow", () => {
    const self = makeBand({
      allow: { cli: ["cmd-a", "cmd-b"] },
      insist: { cli: ["cmd-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.cli.insist).toContain("cmd-a");
    expect(result.capabilities.cli.allow).not.toContain("cmd-a");
    expect(result.capabilities.cli.allow).toContain("cmd-b");
  });

  test("ceiling_allow: includes don't expand ceiling", () => {
    const self = makeBand({
      allow: { cli: ["cmd-a"] },
    });
    const included = makeBand({
      band: "addon",
      allow: { cli: ["cmd-a", "cmd-b"] },
    });
    const result = computeEffective(self, [], [included]);
    // tool-b was requested by include but not in ceiling (self+extends only has tool-a)
    expect(result.capabilities.cli.allow).toContain("cmd-a");
    expect(result.capabilities.cli.allow).not.toContain("cmd-b");
  });

  test("extends expand ceiling", () => {
    const parent = makeBand({
      band: "parent",
      allow: { cli: ["cmd-a", "cmd-b"] },
    });
    const self = makeBand({
      allow: { cli: ["cmd-a"] },
    });
    const result = computeEffective(self, [parent], []);
    expect(result.capabilities.cli.allow).toContain("cmd-a");
    expect(result.capabilities.cli.allow).toContain("cmd-b");
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
    expect(result.capabilities.cli.allow).toEqual([]);
    expect(result.capabilities.cli.deny).toEqual([]);
    expect(result.capabilities.cli.insist).toEqual([]);
  });
});
