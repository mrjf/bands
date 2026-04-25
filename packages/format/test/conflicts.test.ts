import { describe, test, expect } from "bun:test";
import { detectConflicts } from "../src/conflicts";
import { computeEffective } from "../src/effective";
import type { BandDocument } from "../src/types";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return { band: "test",  icon: "🎵", ...overrides };
}

describe("detectConflicts", () => {
  test("no conflicts for simple band", () => {
    const self = makeBand({
      allow: { cli: ["cmd-a"] },
    });
    const effective = computeEffective(self, [], []);
    const conflicts = detectConflicts(self, [], [], effective);
    expect(conflicts).toHaveLength(0);
  });

  test("deny-insist conflict", () => {
    const self = makeBand({
      deny: { cli: ["cmd-a"] },
      insist: { cli: ["cmd-a"] },
    });
    const effective = computeEffective(self, [], []);
    const conflicts = detectConflicts(self, [], [], effective);
    expect(conflicts.some((c) => c.type === "deny-insist" && c.item === "cmd-a")).toBe(true);
  });

  test("ceiling-exceeded conflict for included band", () => {
    const self = makeBand({
      band: "parent",
      allow: { cli: ["cmd-a"] },
    });
    const included = makeBand({
      band: "addon",
      allow: { cli: ["cmd-a", "cmd-b"] },
    });
    const effective = computeEffective(self, [], [included]);
    const conflicts = detectConflicts(self, [], [included], effective);
    expect(conflicts.some((c) => c.type === "ceiling-exceeded" && c.item === "cmd-b")).toBe(true);
  });

  test("requires-unsatisfied conflict", () => {
    const self = makeBand({
      band: "parent",
      deny: { net: ["api.blocked.com"] },
    });
    const included = makeBand({
      band: "addon",
      requires: { network: { egress: ["api.blocked.com"] } },
    });
    const effective = computeEffective(self, [], [included]);
    const conflicts = detectConflicts(self, [], [included], effective);
    expect(conflicts.some((c) => c.type === "requires-unsatisfied")).toBe(true);
  });
});
