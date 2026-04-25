import { describe, test, expect } from "bun:test";
import { validate } from "../src/validate";

describe("validate", () => {
  test("valid minimal document has no errors", () => {
    const { errors } = validate({ band: "test", icon: "🎵", description: "test" });
    expect(errors).toHaveLength(0);
  });

  test("errors on missing required fields", () => {
    const { errors } = validate({});
    expect(errors.some((e) => e.path === "band")).toBe(true);
    expect(errors.some((e) => e.path === "icon")).toBe(true);
    expect(errors.some((e) => e.path === "description")).toBe(true);
  });

  test("warns on unknown top-level keys", () => {
    const { warnings } = validate({ band: "test",  icon: "🎵", unknown_key: true });
    expect(warnings.some((w) => w.path === "unknown_key")).toBe(true);
  });

  test("errors on wrong type for band", () => {
    const { errors } = validate({ band: 123,  icon: "🎵" });
    expect(errors.some((e) => e.path === "band")).toBe(true);
  });

  test("errors on non-kebab-case band name", () => {
    const { errors } = validate({ band: "Test Band", icon: "🎵", description: "test" });
    expect(errors.some((e) => e.path === "band")).toBe(true);
  });

  test("warns on non-GitHub URL in extends", () => {
    const { warnings } = validate({
      band: "test",
      
      icon: "🎵",
      extends: ["not-a-github-url"],
    });
    expect(warnings.some((w) => w.path === "extends[0]")).toBe(true);
  });

  test("validates allow.cli items are strings", () => {
    const { errors } = validate({
      band: "test",
      icon: "🎵",
      allow: {
        cli: [42 as any],
      },
    });
    expect(errors.some((e) => e.path.includes("allow.cli"))).toBe(true);
  });

  test("validates limit fields are numbers", () => {
    const { errors } = validate({
      band: "test",

      icon: "🎵",
      limit: { maxInputBytes: "not-a-number" },
    });
    expect(errors.some((e) => e.path === "limit.maxInputBytes")).toBe(true);
  });

  test("warns on unknown limit fields", () => {
    const { warnings } = validate({
      band: "test",

      icon: "🎵",
      limit: { unknownLimit: 100 },
    });
    expect(warnings.some((w) => w.path === "limit.unknownLimit")).toBe(true);
  });

  test("errors on non-object contract", () => {
    const { errors } = validate({
      band: "test",
      icon: "🎵",
      contract: "not-an-object",
    });
    expect(errors.some((e) => e.path === "contract")).toBe(true);
  });

  test("errors on invalid type for contract.input", () => {
    const { errors } = validate({
      band: "test",
      icon: "🎵",
      contract: { input: 42 },
    });
    expect(errors.some((e) => e.path === "contract.input")).toBe(true);
  });

  test("errors on invalid type for contract.output", () => {
    const { errors } = validate({
      band: "test",
      icon: "🎵",
      contract: { output: 42 },
    });
    expect(errors.some((e) => e.path === "contract.output")).toBe(true);
  });

  test("accepts string path ref for contract.input", () => {
    const { errors, warnings } = validate({
      band: "test",
      icon: "🎵",
      description: "test",
      contract: { input: "./schemas/input.json" },
    });
    expect(errors).toHaveLength(0);
    expect(warnings.filter((w) => w.path.startsWith("contract"))).toHaveLength(0);
  });

  test("accepts string URL ref for contract.output", () => {
    const { errors, warnings } = validate({
      band: "test",
      icon: "🎵",
      description: "test",
      contract: { output: "https://example.com/schema.json" },
    });
    expect(errors).toHaveLength(0);
    expect(warnings.filter((w) => w.path.startsWith("contract"))).toHaveLength(0);
  });

  test("warns on string that is not a path or URL", () => {
    const { errors, warnings } = validate({
      band: "test",
      icon: "🎵",
      description: "test",
      contract: { input: "just-a-string" },
    });
    expect(errors).toHaveLength(0);
    expect(warnings.some((w) => w.path === "contract.input")).toBe(true);
  });

  test("warns on unknown keys inside contract", () => {
    const { warnings } = validate({
      band: "test",
      icon: "🎵",
      contract: { input: { type: "object" }, extra: true },
    });
    expect(warnings.some((w) => w.path === "contract.extra")).toBe(true);
  });

  test("valid contract produces no errors or warnings", () => {
    const { errors, warnings } = validate({
      band: "test",
      icon: "🎵",
      description: "test",
      contract: {
        input: { type: "object", properties: { msg: { type: "string" } } },
        output: { type: "object" },
      },
    });
    expect(errors).toHaveLength(0);
    expect(warnings.filter((w) => w.path.startsWith("contract"))).toHaveLength(0);
  });

  test("does not warn on band-namespaced config key", () => {
    const { warnings } = validate({
      band: "slack",
      icon: "💬",
      description: "Slack skill",
      slack: { channels: { allow: [], deny: [] }, dm: false },
    });
    expect(warnings.some((w) => w.path === "slack")).toBe(false);
  });

  test("still warns on unknown keys that are not the band name", () => {
    const { warnings } = validate({
      band: "slack",
      icon: "💬",
      description: "Slack skill",
      slack: { dm: false },
      other_unknown: true,
    });
    expect(warnings.some((w) => w.path === "slack")).toBe(false);
    expect(warnings.some((w) => w.path === "other_unknown")).toBe(true);
  });
});
