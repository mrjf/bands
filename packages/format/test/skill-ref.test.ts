import { describe, test, expect } from "bun:test";
import { parseSkillRef, normalizeSkillRef } from "../src/skill-ref";

describe("parseSkillRef", () => {
  test("string GitHub URL → kind: github", () => {
    const result = parseSkillRef("https://github.com/acme/skills/tree/main/summarize");
    expect(result).toEqual({
      kind: "github",
      ref: "https://github.com/acme/skills/tree/main/summarize",
    });
  });

  test("string local path → kind: local", () => {
    const result = parseSkillRef("./skills/summarize");
    expect(result).toEqual({ kind: "local", ref: "./skills/summarize" });
  });

  test("object with kind: github", () => {
    const result = parseSkillRef({
      kind: "github",
      ref: "https://github.com/acme/skills/tree/main/summarize",
    });
    expect(result).toEqual({
      kind: "github",
      ref: "https://github.com/acme/skills/tree/main/summarize",
    });
  });

  test("object with kind: local", () => {
    const result = parseSkillRef({ kind: "local", ref: "./skills/foo" });
    expect(result).toEqual({ kind: "local", ref: "./skills/foo" });
  });

  test("invalid object → null", () => {
    expect(parseSkillRef({ kind: "unknown", ref: "foo" })).toBeNull();
    expect(parseSkillRef({ bad: "shape" })).toBeNull();
    expect(parseSkillRef(42)).toBeNull();
    expect(parseSkillRef(null)).toBeNull();
  });
});

describe("normalizeSkillRef", () => {
  test("normalizes mixed array", () => {
    const result = normalizeSkillRef([
      "https://github.com/acme/skills/tree/main/a",
      { kind: "local", ref: "./skills/b" },
      42 as unknown as string, // invalid, should be filtered
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("github");
    expect(result[1].kind).toBe("local");
  });
});
