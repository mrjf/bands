import { describe, test, expect } from "bun:test";
import { normalize } from "../src/normalize";
import type { BandDocument } from "../src/types";

describe("normalize", () => {
  test("sorts extends array", () => {
    const doc: BandDocument = {
      band: "test",
      
      icon: "🎵",
      extends: ["b", "a"],
    };
    const result = normalize(doc);
    expect(result.extends).toEqual(["a", "b"]);
  });

  test("sorts allow.tools array", () => {
    const doc: BandDocument = {
      band: "test",

      icon: "🎵",
      allow: {
        tools: ["c", "a", "b"],
      },
    };
    const result = normalize(doc);
    expect(result.allow?.tools).toEqual(["a", "b", "c"]);
  });

  test("does not mutate original", () => {
    const doc: BandDocument = {
      band: "test",
      
      icon: "🎵",
      extends: ["b", "a"],
    };
    normalize(doc);
    expect(doc.extends).toEqual(["b", "a"]);
  });

  test("handles empty document", () => {
    const doc: BandDocument = { band: "test",  icon: "🎵" };
    const result = normalize(doc);
    expect(result.band).toBe("test");
  });
});
