import { describe, expect, test } from "bun:test";
import { join } from "path";
import { discoverBandForScript } from "../../../src/banded-skills/discovery";

const FIXTURES = join(import.meta.dir, "../../fixtures/banded-skills");

describe("discoverBandForScript", () => {
  test("per-script BAND.md wins when present", () => {
    const skillRoot = join(FIXTURES, "valid-skill");
    const result = discoverBandForScript(skillRoot, "echo-input");

    expect(result).not.toBeNull();
    expect(result!.source).toBe("per-script");
    expect(result!.band.band).toBe("echo-input");
    expect(result!.band.allow?.cli).toContain("echo *");
    expect(result!.band.allow?.cli).toContain("cat *");
  });

  test("falls back to top-level when no per-script BAND.md", () => {
    const skillRoot = join(FIXTURES, "valid-skill");
    // transform-text has no per-script BAND.md, no scripts/BAND.md → falls to top-level
    const result = discoverBandForScript(skillRoot, "transform-text");

    expect(result).not.toBeNull();
    expect(result!.source).toBe("top-level");
    expect(result!.band.band).toBe("valid-skill");
  });

  test("resolves path reference in BAND.md", () => {
    const skillRoot = join(FIXTURES, "ref-skill");
    const result = discoverBandForScript(skillRoot, "echo-input");

    expect(result).not.toBeNull();
    // Should resolve to the shared/restricted.band.md
    expect(result!.source).toBe("top-level");
    expect(result!.band.band).toBe("restricted");
    expect(result!.band.description).toBe(
      "Shared restricted band referenced by ref-skill"
    );
  });

  test("returns null when no BAND.md found anywhere", () => {
    const skillRoot = join(FIXTURES, "invalid-skill");
    const result = discoverBandForScript(skillRoot, "broken");

    expect(result).toBeNull();
  });

  test("returns null for non-existent script in valid skill", () => {
    const skillRoot = join(FIXTURES, "valid-skill");
    const result = discoverBandForScript(skillRoot, "non-existent");

    // Should still fall back to top-level
    expect(result).not.toBeNull();
    expect(result!.source).toBe("top-level");
  });
});
