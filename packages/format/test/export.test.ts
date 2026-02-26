import { describe, test, expect } from "bun:test";
import { exportBandMd } from "../src/export";
import type { BandDocument } from "../src/types";

describe("exportBandMd", () => {
  test("exports minimal document", () => {
    const doc: BandDocument = { band: "test",  icon: "🎵" };
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
        tools: ["https://github.com/acme/tools/tree/main/b", "https://github.com/acme/tools/tree/main/a"],
      },
      deny: {
        tools: ["https://github.com/acme/tools/tree/main/c"],
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
      allow: { tools: ["a"] },
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
});
