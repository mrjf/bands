import { describe, expect, test } from "bun:test";
import { compileBand } from "../../src/loader";
import type { BandDocument } from "@bands/format";

/** Helper to create a minimal valid BandDocument */
function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return {
    band: "test-band",
    icon: "🎸",
    description: "A test band",
    ...overrides,
  };
}

describe("compileBand", () => {
  describe("default limits", () => {
    test("applies all default limits when band has no limit field", () => {
      const result = compileBand(makeBand());

      expect(result.limits.maxInputBytes).toBe(1024 * 1024);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(30000);
      expect(result.limits.maxCostDollars).toBe(1);
    });

    test("applies all default limits when limit is undefined", () => {
      const result = compileBand(makeBand({ limit: undefined }));

      expect(result.limits.maxInputBytes).toBe(1024 * 1024);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(30000);
      expect(result.limits.maxCostDollars).toBe(1);
    });

    test("applies all default limits when limit is an empty object", () => {
      const result = compileBand(makeBand({ limit: {} }));

      expect(result.limits.maxInputBytes).toBe(1024 * 1024);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(30000);
      expect(result.limits.maxCostDollars).toBe(1);
    });
  });

  describe("partial limits", () => {
    test("overrides only maxInputBytes, defaults the rest", () => {
      const result = compileBand(makeBand({ limit: { maxInputBytes: 512 } }));

      expect(result.limits.maxInputBytes).toBe(512);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(30000);
      expect(result.limits.maxCostDollars).toBe(1);
    });

    test("overrides only maxOutputBytes, defaults the rest", () => {
      const result = compileBand(makeBand({ limit: { maxOutputBytes: 2048 } }));

      expect(result.limits.maxInputBytes).toBe(1024 * 1024);
      expect(result.limits.maxOutputBytes).toBe(2048);
      expect(result.limits.maxRuntimeMs).toBe(30000);
      expect(result.limits.maxCostDollars).toBe(1);
    });

    test("overrides only maxRuntimeMs, defaults the rest", () => {
      const result = compileBand(makeBand({ limit: { maxRuntimeMs: 5000 } }));

      expect(result.limits.maxInputBytes).toBe(1024 * 1024);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(5000);
      expect(result.limits.maxCostDollars).toBe(1);
    });

    test("overrides only maxCostDollars, defaults the rest", () => {
      const result = compileBand(makeBand({ limit: { maxCostDollars: 0.5 } }));

      expect(result.limits.maxInputBytes).toBe(1024 * 1024);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(30000);
      expect(result.limits.maxCostDollars).toBe(0.5);
    });

    test("overrides two fields, defaults the other two", () => {
      const result = compileBand(
        makeBand({ limit: { maxInputBytes: 256, maxRuntimeMs: 60000 } }),
      );

      expect(result.limits.maxInputBytes).toBe(256);
      expect(result.limits.maxOutputBytes).toBe(10 * 1024 * 1024);
      expect(result.limits.maxRuntimeMs).toBe(60000);
      expect(result.limits.maxCostDollars).toBe(1);
    });
  });

  describe("full limits override", () => {
    test("uses all provided limits with no defaults", () => {
      const result = compileBand(
        makeBand({
          limit: {
            maxInputBytes: 100,
            maxOutputBytes: 200,
            maxRuntimeMs: 300,
            maxCostDollars: 0.01,
          },
        }),
      );

      expect(result.limits.maxInputBytes).toBe(100);
      expect(result.limits.maxOutputBytes).toBe(200);
      expect(result.limits.maxRuntimeMs).toBe(300);
      expect(result.limits.maxCostDollars).toBe(0.01);
    });
  });

  describe("edge cases for limit values", () => {
    test("preserves zero for maxInputBytes (nullish coalescing keeps 0)", () => {
      const result = compileBand(makeBand({ limit: { maxInputBytes: 0 } }));

      expect(result.limits.maxInputBytes).toBe(0);
    });

    test("preserves zero for maxOutputBytes (nullish coalescing keeps 0)", () => {
      const result = compileBand(makeBand({ limit: { maxOutputBytes: 0 } }));

      expect(result.limits.maxOutputBytes).toBe(0);
    });

    test("preserves zero for maxRuntimeMs (nullish coalescing keeps 0)", () => {
      const result = compileBand(makeBand({ limit: { maxRuntimeMs: 0 } }));

      expect(result.limits.maxRuntimeMs).toBe(0);
    });

    test("preserves zero for maxCostDollars (nullish coalescing keeps 0)", () => {
      const result = compileBand(makeBand({ limit: { maxCostDollars: 0 } }));

      expect(result.limits.maxCostDollars).toBe(0);
    });

    test("handles very large limit values", () => {
      const result = compileBand(
        makeBand({
          limit: {
            maxInputBytes: Number.MAX_SAFE_INTEGER,
            maxOutputBytes: Number.MAX_SAFE_INTEGER,
            maxRuntimeMs: Number.MAX_SAFE_INTEGER,
            maxCostDollars: Number.MAX_SAFE_INTEGER,
          },
        }),
      );

      expect(result.limits.maxInputBytes).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.limits.maxOutputBytes).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.limits.maxRuntimeMs).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.limits.maxCostDollars).toBe(Number.MAX_SAFE_INTEGER);
    });

    test("handles fractional cost values", () => {
      const result = compileBand(
        makeBand({ limit: { maxCostDollars: 0.001 } }),
      );

      expect(result.limits.maxCostDollars).toBe(0.001);
    });
  });

  describe("firewall", () => {
    test("creates empty firewall when band has no allow.net", () => {
      const result = compileBand(makeBand());

      expect(result.firewall.allowedDns).toBeInstanceOf(Set);
      expect(result.firewall.allowedDns.size).toBe(0);
      expect(result.firewall.allowedIp).toBeInstanceOf(Set);
      expect(result.firewall.allowedIp.size).toBe(0);
      expect(result.firewall.deniedIp).toBeInstanceOf(Set);
      expect(result.firewall.deniedIp.size).toBe(0);
      expect(result.firewall.defaultEgress).toBe("deny");
    });

    test("populates allowedDns from band allow.net", () => {
      const result = compileBand(
        makeBand({
          allow: { net: ["api.github.com", "registry.npmjs.org"] },
        }),
      );

      expect(result.firewall.allowedDns.size).toBe(2);
      expect(result.firewall.allowedDns.has("api.github.com")).toBe(true);
      expect(result.firewall.allowedDns.has("registry.npmjs.org")).toBe(true);
    });

    test("populates allowedDns with a single entry", () => {
      const result = compileBand(
        makeBand({ allow: { net: ["example.com"] } }),
      );

      expect(result.firewall.allowedDns.size).toBe(1);
      expect(result.firewall.allowedDns.has("example.com")).toBe(true);
    });

    test("handles empty allow.net array", () => {
      const result = compileBand(makeBand({ allow: { net: [] } }));

      expect(result.firewall.allowedDns.size).toBe(0);
    });

    test("handles allow object without net field", () => {
      const result = compileBand(
        makeBand({ allow: { cli: ["echo *"] } }),
      );

      expect(result.firewall.allowedDns.size).toBe(0);
    });

    test("default egress is always deny", () => {
      const result = compileBand(
        makeBand({
          allow: { net: ["*"] },
        }),
      );

      expect(result.firewall.defaultEgress).toBe("deny");
    });

    test("deduplicates DNS entries via Set", () => {
      const result = compileBand(
        makeBand({
          allow: { net: ["example.com", "example.com", "example.com"] },
        }),
      );

      expect(result.firewall.allowedDns.size).toBe(1);
    });
  });

  describe("band passthrough", () => {
    test("returns the original band document unchanged", () => {
      const band = makeBand({
        version: 2,
        description: "A custom description",
        allow: { cli: ["echo *"], net: ["example.com"] },
        limit: { maxRuntimeMs: 10000 },
      });

      const result = compileBand(band);

      expect(result.band).toBe(band);
    });

    test("preserves all band fields", () => {
      const band = makeBand({
        extends: ["base-band"],
        includes: ["helper-band"],
        env: { secrets: ["API_KEY"], variables: ["DEBUG=true"] },
        execution: { target: "local-dangerously" },
      });

      const result = compileBand(band);

      expect(result.band.extends).toEqual(["base-band"]);
      expect(result.band.includes).toEqual(["helper-band"]);
      expect(result.band.env?.secrets).toEqual(["API_KEY"]);
      expect(result.band.execution?.target).toBe("local-dangerously");
    });
  });

  describe("return structure", () => {
    test("returns object with band, limits, and firewall keys", () => {
      const result = compileBand(makeBand());

      expect(result).toHaveProperty("band");
      expect(result).toHaveProperty("limits");
      expect(result).toHaveProperty("firewall");
      expect(Object.keys(result)).toHaveLength(3);
    });

    test("limits object has exactly four keys", () => {
      const result = compileBand(makeBand());

      const keys = Object.keys(result.limits);
      expect(keys).toContain("maxInputBytes");
      expect(keys).toContain("maxOutputBytes");
      expect(keys).toContain("maxRuntimeMs");
      expect(keys).toContain("maxCostDollars");
      expect(keys).toHaveLength(4);
    });

    test("firewall object has exactly four keys", () => {
      const result = compileBand(makeBand());

      const keys = Object.keys(result.firewall);
      expect(keys).toContain("allowedDns");
      expect(keys).toContain("allowedIp");
      expect(keys).toContain("deniedIp");
      expect(keys).toContain("defaultEgress");
      expect(keys).toHaveLength(4);
    });
  });
});
