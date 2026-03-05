import { describe, expect, test } from "bun:test";
import { join } from "path";
import { validateBandedSkill } from "../../../src/banded-skills/validator";

const FIXTURES = join(import.meta.dir, "../../fixtures/banded-skills");

describe("validateBandedSkill", () => {
  test("valid skill passes validation", () => {
    const result = validateBandedSkill(join(FIXTURES, "valid-skill"));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("missing BAND.md is caught", () => {
    const result = validateBandedSkill(join(FIXTURES, "invalid-skill"));

    expect(result.valid).toBe(false);
    const bandError = result.errors.find((e) => e.path === "BAND.md");
    expect(bandError).toBeDefined();
    expect(bandError!.message).toContain("missing");
  });

  test("invalid JSON schemas are caught", () => {
    const result = validateBandedSkill(join(FIXTURES, "invalid-skill"));

    expect(result.valid).toBe(false);
    const schemaError = result.errors.find((e) =>
      e.message.includes("Invalid JSON")
    );
    expect(schemaError).toBeDefined();
  });

  test("orphaned resources produce warnings", () => {
    const result = validateBandedSkill(join(FIXTURES, "invalid-skill"));

    const orphanWarning = result.warnings.find((w) =>
      w.message.includes("Orphaned")
    );
    expect(orphanWarning).toBeDefined();
  });

  test("ref-skill with path reference passes", () => {
    const result = validateBandedSkill(join(FIXTURES, "ref-skill"));

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
