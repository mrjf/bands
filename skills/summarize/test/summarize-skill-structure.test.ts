/**
 * Summarize Skill — Structure tests (no API key needed)
 */

import { describe, expect, test } from "bun:test";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { SKILL_ROOT, RESOURCES } from "./summarize-helpers";

describe("summarize skill: structure", () => {
  test("SKILL.md exists", () => {
    expect(existsSync(join(SKILL_ROOT, "SKILL.md"))).toBe(true);
  });

  test("BAND.md exists", () => {
    expect(existsSync(join(SKILL_ROOT, "BAND.md"))).toBe(true);
  });

  test("BAND.md requires ANTHROPIC_API_KEY", () => {
    const band = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    expect(band).toContain("ANTHROPIC_API_KEY");
  });

  test("BAND.md allows api.anthropic.com", () => {
    const band = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    expect(band).toContain("api.anthropic.com");
  });

  test("BAND.md allows claude and curl CLI", () => {
    const band = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    expect(band).toContain("claude *");
    expect(band).toContain("curl *");
  });

  test("BAND.md insists on claude being called", () => {
    const band = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    expect(band).toContain("insist:");
    expect(band).toMatch(/insist:[\s\S]*claude \*/);
  });

  test("summarize script has run.sh", () => {
    expect(existsSync(join(RESOURCES, "summarize", "run.sh"))).toBe(true);
  });

  test("summarize script has input schema", () => {
    expect(existsSync(join(SKILL_ROOT, "schemas", "input", "summarize.json"))).toBe(true);
  });

  test("summarize script has output schema", () => {
    expect(existsSync(join(SKILL_ROOT, "schemas", "output", "summarize.json"))).toBe(true);
  });

  test("input schema has document and url fields", () => {
    const schema = JSON.parse(readFileSync(join(SKILL_ROOT, "schemas", "input", "summarize.json"), "utf-8"));
    expect(schema.properties.document.type).toBe("string");
    expect(schema.properties.url.type).toBe("string");
  });

  test("input schema has optional guidance field", () => {
    const schema = JSON.parse(readFileSync(join(SKILL_ROOT, "schemas", "input", "summarize.json"), "utf-8"));
    expect(schema.properties.guidance.type).toBe("string");
  });

  test("output schema requires summary field", () => {
    const schema = JSON.parse(readFileSync(join(SKILL_ROOT, "schemas", "output", "summarize.json"), "utf-8"));
    expect(schema.required).toContain("summary");
    expect(schema.properties.summary.type).toBe("string");
  });

  test("--help shows schema for summarize script", async () => {
    const { bandExec } = await import("../../../packages/runtime/src/banded-skills/exec");
    const result = await bandExec({
      resourceDir: join(RESOURCES, "summarize"),
      args: {},
      help: true,
      skillRoot: SKILL_ROOT,
    });
    if (!result.success) throw new Error(`summarize --help failed: ${result.error}`);
    const help = result.data as string;
    expect(help).toContain("Script: summarize");
    expect(help).toContain("Input Schema:");
    expect(help).toContain("document");
    expect(help).toContain("Output Schema:");
    expect(help).toContain("summary");
  });

  test("wrapper script exists and calls band exec", () => {
    const wrapper = join(SKILL_ROOT, "scripts", "summarize");
    expect(existsSync(wrapper)).toBe(true);
    const content = readFileSync(wrapper, "utf-8");
    expect(content).toContain("exec");
    expect(content).toContain("resources/summarize");
  });
});
