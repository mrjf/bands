import { describe, test, expect } from "bun:test";
import { validate } from "../src/validate";

describe("validate", () => {
  test("valid minimal document has no errors", () => {
    const { errors } = validate({ band: "test",  icon: "🎵" });
    expect(errors).toHaveLength(0);
  });

  test("warns on missing required fields", () => {
    const { warnings } = validate({});
    expect(warnings.some((w) => w.path === "band")).toBe(true);
    expect(warnings.some((w) => w.path === "icon")).toBe(true);
    expect(warnings.some((w) => w.path === "description")).toBe(true);
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

  test("validates allow.tools items as GitHub URLs", () => {
    const { warnings } = validate({
      band: "test",

      icon: "🎵",
      allow: {
        tools: ["not-a-url"],
      },
    });
    expect(warnings.some((w) => w.path.includes("allow.tools"))).toBe(true);
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
});
