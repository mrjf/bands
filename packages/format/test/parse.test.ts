import { describe, test, expect } from "bun:test";
import { parseBandMd } from "../src/parse";

describe("parseBandMd", () => {
  test("parses minimal band", () => {
    const source = `---
band: test-band
icon: "🎵"
description: "A test band"
---`;
    const result = parseBandMd(source);
    expect(result.errors).toHaveLength(0);
    expect(result.document.band).toBe("test-band");
    expect(result.document.icon).toBe("🎵");
  });

  test("parses band with markdown body", () => {
    const source = `---
band: test-band
icon: "🎵"
description: "A test band"
---

# Hello

This is the body.`;
    const result = parseBandMd(source);
    expect(result.errors).toHaveLength(0);
    expect(result.document.body).toContain("# Hello");
    expect(result.document.body).toContain("This is the body.");
  });

  test("parses band with permissions", () => {
    const source = `---
band: cap-band
icon: "🔧"
description: "A band with permissions"
allow:
  tools:
    - https://github.com/acme/tools/tree/main/search
deny:
  tools:
    - https://github.com/acme/tools/tree/main/dangerous
---`;
    const result = parseBandMd(source);
    expect(result.errors).toHaveLength(0);
    expect(result.document.allow?.tools).toHaveLength(1);
    expect(result.document.deny?.tools).toHaveLength(1);
  });

  test("parses band with skills (mixed refs)", () => {
    const source = `---
band: skills-band
icon: "📚"
description: "Skills band"
allow:
  skills:
    - https://github.com/acme/skills/tree/main/summarize
    - kind: local
      ref: ./skills/custom
---`;
    const result = parseBandMd(source);
    expect(result.errors).toHaveLength(0);
    const skills = result.document.allow?.skills;
    expect(skills).toHaveLength(2);
  });

  test("errors on missing frontmatter", () => {
    const result = parseBandMd("no frontmatter here");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("Missing frontmatter");
  });

  test("errors on unclosed frontmatter", () => {
    const result = parseBandMd("---\nband: test\n");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("Missing closing");
  });

  test("errors on invalid YAML", () => {
    const result = parseBandMd("---\n: : : invalid\n---");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("warns on missing required fields", () => {
    const source = `---
icon: "❌"
---`;
    const result = parseBandMd(source);
    expect(result.warnings.some((w) => w.path === "band")).toBe(true);
    expect(result.warnings.some((w) => w.path === "description")).toBe(true);
  });
});
