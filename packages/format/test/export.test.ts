import { describe, test, expect } from "bun:test";
import { exportBandMd } from "../src/export";
import type { BandDocument } from "../src/types";

describe("exportBandMd", () => {
  test("exports minimal document", () => {
    const doc: BandDocument = { band: "test", icon: "🎵", description: "test" };
    const output = exportBandMd(doc);
    expect(output).toStartWith("---\n");
    expect(output).toContain("band: test");
    expect(output).toContain("icon:");
    expect(output).toMatch(/---\n$/);
  });

  test("exports document with body", () => {
    const doc: BandDocument = {
      band: "test",
      
      icon: "🎵",
      body: "# Hello\n\nBody text.",
    };
    const output = exportBandMd(doc);
    expect(output).toContain("---\n\n# Hello");
    expect(output).toContain("Body text.");
  });

  test("exports document with permissions", () => {
    const doc: BandDocument = {
      band: "test",

      icon: "🔧",
      allow: {
        read: ["https://github.com/acme/tools/tree/main/b", "https://github.com/acme/tools/tree/main/a"],
      },
      deny: {
        read: ["https://github.com/acme/tools/tree/main/c"],
      },
    };
    const output = exportBandMd(doc);
    // Should be sorted: a before b
    const aIdx = output.indexOf("tools/tree/main/a");
    const bIdx = output.indexOf("tools/tree/main/b");
    expect(aIdx).toBeLessThan(bIdx);
  });

  test("omits undefined fields", () => {
    const doc: BandDocument = { band: "test", icon: "🎵" };
    const output = exportBandMd(doc);
    expect(output).not.toContain("description");
    expect(output).not.toContain("extends");
    expect(output).not.toContain("allow");
    expect(output).not.toContain("deny");
  });

  test("stable key ordering", () => {
    const doc: BandDocument = {
      band: "test",
      icon: "🎵",
      description: "desc",
      allow: { read: ["a"] },
    };
    const output = exportBandMd(doc);
    const iconIdx = output.indexOf("icon:");
    const bandIdx = output.indexOf("band:");
    const descIdx = output.indexOf("description:");
    const allowIdx = output.indexOf("allow:");

    expect(iconIdx).toBeLessThan(bandIdx);
    expect(bandIdx).toBeLessThan(descIdx);
    expect(descIdx).toBeLessThan(allowIdx);
  });

  test("exports bandConfig under band name key", () => {
    const doc: BandDocument = {
      band: "slack",
      icon: "💬",
      description: "Slack skill",
      bandConfig: { channels: { allow: [], deny: [] }, dm: false, threads: true },
    };
    const output = exportBandMd(doc);
    expect(output).toContain("slack:");
    expect(output).toContain("dm: false");
    expect(output).toContain("threads: true");
    expect(output).toContain("channels:");
  });

  test("bandConfig round-trips through parse and export", () => {
    const doc: BandDocument = {
      band: "my-skill",
      icon: "🔧",
      description: "Test skill",
      bandConfig: { feature: true, items: ["a", "b"] },
    };
    const exported = exportBandMd(doc);
    const { parseBandMd } = require("../src/parse");
    const parsed = parseBandMd(exported);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.document.bandConfig).toEqual({ feature: true, items: ["a", "b"] });
  });

  test("omits bandConfig key when not present", () => {
    const doc: BandDocument = { band: "test", icon: "🎵" };
    const output = exportBandMd(doc);
    // Should not have a "test:" key in the output
    expect(output).not.toMatch(/^test:/m);
  });
});
