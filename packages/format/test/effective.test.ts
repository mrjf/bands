import { describe, test, expect } from "bun:test";
import { computeEffective } from "../src/effective";
import type { BandDocument } from "../src/types";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return { band: "test",  icon: "🎵", ...overrides };
}

describe("computeEffective", () => {
  test("simple allow/deny/insist from self only", () => {
    const self = makeBand({
      allow: { tools: ["tool-a", "tool-b"] },
      deny: { tools: ["tool-c"] },
      insist: { tools: ["tool-d"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.tools.allow).toEqual(["tool-a", "tool-b"]);
    expect(result.capabilities.tools.deny).toEqual(["tool-c"]);
    expect(result.capabilities.tools.insist).toEqual(["tool-d"]);
  });

  test("deny wins over insist", () => {
    const self = makeBand({
      deny: { tools: ["tool-a"] },
      insist: { tools: ["tool-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.tools.deny).toContain("tool-a");
    expect(result.capabilities.tools.insist).not.toContain("tool-a");
  });

  test("deny wins over allow", () => {
    const self = makeBand({
      allow: { tools: ["tool-a"] },
      deny: { tools: ["tool-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.tools.deny).toContain("tool-a");
    expect(result.capabilities.tools.allow).not.toContain("tool-a");
  });

  test("insist items removed from allow", () => {
    const self = makeBand({
      allow: { tools: ["tool-a", "tool-b"] },
      insist: { tools: ["tool-a"] },
    });
    const result = computeEffective(self, [], []);
    expect(result.capabilities.tools.insist).toContain("tool-a");
    expect(result.capabilities.tools.allow).not.toContain("tool-a");
    expect(result.capabilities.tools.allow).toContain("tool-b");
  });

  test("ceiling_allow: includes don't expand ceiling", () => {
    const self = makeBand({
      allow: { tools: ["tool-a"] },
    });
    const included = makeBand({
      band: "addon",
      allow: { tools: ["tool-a", "tool-b"] },
    });
    const result = computeEffective(self, [], [included]);
    // tool-b was requested by include but not in ceiling (self+extends only has tool-a)
    expect(result.capabilities.tools.allow).toContain("tool-a");
    expect(result.capabilities.tools.allow).not.toContain("tool-b");
  });

  test("extends expand ceiling", () => {
    const parent = makeBand({
      band: "parent",
      allow: { tools: ["tool-a", "tool-b"] },
    });
    const self = makeBand({
      allow: { tools: ["tool-a"] },
    });
    const result = computeEffective(self, [parent], []);
    expect(result.capabilities.tools.allow).toContain("tool-a");
    expect(result.capabilities.tools.allow).toContain("tool-b");
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
    expect(result.capabilities.tools.allow).toEqual([]);
    expect(result.capabilities.tools.deny).toEqual([]);
    expect(result.capabilities.tools.insist).toEqual([]);
  });
});
