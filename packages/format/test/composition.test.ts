import { describe, test, expect } from "bun:test";
import { resolve } from "../src/resolve";
import type { BandDocument, BandLoader } from "../src/types";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return {
    band: "test",
    icon: "🎵",
    description: "Test band",
    ...overrides,
  };
}

describe("Composition end-to-end", () => {
  test("extends restricts — parent deny removes from child effective allow", async () => {
    const parent = makeBand({
      band: "parent",
      allow: { net: ["api.github.com", "api.example.com"] },
      deny: { net: ["api.evil.com"] },
    });
    const child = makeBand({
      band: "child",
      extends: ["parent"],
      allow: { net: ["api.github.com", "api.evil.com"] },
    });

    const bands: Record<string, BandDocument> = { parent };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(child, loader);
    const effectiveNet = result.effective.capabilities.net;

    // child allows api.evil.com but parent denies it → removed from effective
    expect(effectiveNet.allow).toContain("api.github.com");
    expect(effectiveNet.allow).toContain("api.example.com");
    expect(effectiveNet.allow).not.toContain("api.evil.com");
    expect(effectiveNet.deny).toContain("api.evil.com");
  });

  test("includes expands (union) — included insist/deny merge with self", async () => {
    const addon = makeBand({
      band: "addon",
      insist: { cli: ["jq *"] },
      deny: { cli: ["rm *"] },
    });
    const main = makeBand({
      band: "main",
      includes: ["addon"],
      allow: { cli: ["npm run *", "jq *"] },
      insist: { cli: ["npm run *"] },
    });

    const bands: Record<string, BandDocument> = { addon };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(main, loader);
    const effectiveCli = result.effective.capabilities.cli;

    // Insist is union of self + included
    expect(effectiveCli.insist).toContain("npm run *");
    expect(effectiveCli.insist).toContain("jq *");

    // Deny from included merges in
    expect(effectiveCli.deny).toContain("rm *");

    // Allow bounded by ceiling (self only, no extends) — includes' allows don't expand
    expect(effectiveCli.allow).not.toContain("rm *");
  });

  test("includes cannot expand beyond extends ceiling", async () => {
    const parent = makeBand({
      band: "parent",
      allow: { read: ["./data/**", "./config/**"] },
    });
    const addon = makeBand({
      band: "addon",
      allow: { read: ["./data/**", "./secrets/**"] },
    });
    const child = makeBand({
      band: "child",
      extends: ["parent"],
      includes: ["addon"],
      allow: { read: ["./data/**"] },
    });

    const bands: Record<string, BandDocument> = { parent, addon };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(child, loader);
    const effectiveRead = result.effective.capabilities.read;

    // ceiling = union(extends_allows, self_allows) = [./data/**, ./config/**]
    // requested = union(extends_allows, self_allows, includes_allows) = [./data/**, ./config/**, ./secrets/**]
    // effective = (requested ∩ ceiling) = [./data/**, ./config/**]
    expect(effectiveRead.allow).toContain("./data/**");
    expect(effectiveRead.allow).toContain("./config/**");
    expect(effectiveRead.allow).not.toContain("./secrets/**");
  });

  test("deny wins over everything", async () => {
    const parent = makeBand({
      band: "parent",
      allow: { net: ["api.github.com", "api.evil.com"] },
      deny: { net: ["api.evil.com"] },
    });
    const child = makeBand({
      band: "child",
      extends: ["parent"],
      allow: { net: ["api.github.com", "api.evil.com"] },
      insist: { net: ["api.evil.com"] },
    });

    const bands: Record<string, BandDocument> = { parent };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(child, loader);
    const effectiveNet = result.effective.capabilities.net;

    // deny from ancestor removes from both effective allow and insist
    expect(effectiveNet.deny).toContain("api.evil.com");
    expect(effectiveNet.allow).not.toContain("api.evil.com");
    expect(effectiveNet.insist).not.toContain("api.evil.com");
  });

  test("limits — most restrictive wins", async () => {
    const parent = makeBand({
      band: "parent",
      limit: { maxRuntimeMs: 60000, maxInputBytes: 1024 },
    });
    const child = makeBand({
      band: "child",
      extends: ["parent"],
      limit: { maxRuntimeMs: 30000, maxInputBytes: 2048 },
    });

    const bands: Record<string, BandDocument> = { parent };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    const result = await resolve(child, loader);

    // Most restrictive (minimum) wins for each field
    expect(result.effective.limits.maxRuntimeMs).toBe(30000);
    expect(result.effective.limits.maxInputBytes).toBe(1024);
  });

  test("cycle detection — A extends B extends A does not infinite loop", async () => {
    const a = makeBand({ band: "a", extends: ["b"], allow: { net: ["a.com"] } });
    const b = makeBand({ band: "b", extends: ["a"], allow: { net: ["b.com"] } });

    const bands: Record<string, BandDocument> = { a, b };
    const loader: BandLoader = async (ref) => bands[ref] ?? null;

    // Should complete without hanging
    const result = await resolve(a, loader);

    // b tries to extend a, but a is already visited → cycle broken
    expect(result.ancestors.length).toBeLessThanOrEqual(1);
    // b is still resolved as ancestor (just without its own recursive extends)
    expect(result.effective.capabilities.net.allow).toContain("b.com");
  });
});
