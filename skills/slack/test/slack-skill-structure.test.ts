/**
 * Slack Skill — Structure validation and help output
 */

import { describe, expect, test } from "bun:test";
import { join } from "path";
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";
import { validateBandedSkill } from "../../../packages/runtime/src/banded-skills/validator";
import { RESOURCES, SKILL_ROOT } from "./slack-helpers";

describe("slack skill: structure & basics", () => {
  test("skill structure validates", () => {
    const result = validateBandedSkill(SKILL_ROOT);
    if (result.errors.length > 0) {
      throw new Error(`Validation errors:\n${result.errors.map(e => `  ${e.path}: ${e.message}`).join("\n")}`);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("--help works for every script", async () => {
    const scripts = [
      "channel-list", "channel-info",
      "message-send", "message-list", "message-search",
      "thread-reply",
      "reaction-add", "reaction-remove",
      "file-upload",
    ];

    for (const script of scripts) {
      const result = await bandExec({
        resourceDir: join(RESOURCES, script),
        args: {},
        help: true,
        skillRoot: SKILL_ROOT,
      });
      if (!result.success) throw new Error(`${script} --help failed: ${result.error}`);
      expect(typeof result.data).toBe("string");
      expect(result.data as string).toContain(script);
    }
  });

  test("all scripts have centralized input schemas", () => {
    const scripts = [
      "channel-list", "channel-info",
      "message-send", "message-list", "message-search",
      "thread-reply",
      "reaction-add", "reaction-remove",
      "file-upload",
    ];

    const { existsSync, readFileSync } = require("fs");
    for (const script of scripts) {
      const schemaPath = join(SKILL_ROOT, "schemas", "input", `${script}.json`);
      expect(existsSync(schemaPath)).toBe(true);
      const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
      expect(schema.type).toBe("object");
      expect(schema.properties).toBeDefined();
    }
  });

  test("all scripts have centralized output schemas", () => {
    const scripts = [
      "channel-list", "channel-info",
      "message-send", "message-list", "message-search",
      "thread-reply",
      "reaction-add", "reaction-remove",
      "file-upload",
    ];

    const { existsSync, readFileSync } = require("fs");
    for (const script of scripts) {
      const schemaPath = join(SKILL_ROOT, "schemas", "output", `${script}.json`);
      expect(existsSync(schemaPath)).toBe(true);
      // Schema exists and is valid JSON
      JSON.parse(readFileSync(schemaPath, "utf-8"));
    }
  });

  test("all scripts have run.sh", () => {
    const scripts = [
      "channel-list", "channel-info",
      "message-send", "message-list", "message-search",
      "thread-reply",
      "reaction-add", "reaction-remove",
      "file-upload",
    ];

    for (const script of scripts) {
      const runShPath = join(RESOURCES, script, "run.sh");
      const { existsSync, readFileSync } = require("fs");
      expect(existsSync(runShPath)).toBe(true);
      const content = readFileSync(runShPath, "utf-8");
      expect(content).toContain("slack-perms.sh");
    }
  });

  test("BAND.md has correct execution target", () => {
    const { readFileSync } = require("fs");
    const bandMd = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    expect(bandMd).toContain("target: local-lima");
    expect(bandMd).toContain("SLACK_BOT_TOKEN");
    expect(bandMd).toContain('curl *');
    expect(bandMd).toContain('jq *');
    expect(bandMd).toContain("slack.com");
  });

  test("SKILL.md has required frontmatter", () => {
    const { readFileSync } = require("fs");
    const skillMd = readFileSync(join(SKILL_ROOT, "SKILL.md"), "utf-8");
    expect(skillMd).toContain("name: slack");
    expect(skillMd).toContain("description:");
    expect(skillMd).toContain("allowed-tools:");
  });

  test("BAND.md has bandConfig with all expected keys", () => {
    const { readFileSync } = require("fs");
    const { parseBandMd } = require("../../../packages/format/src/parse");
    const bandMd = readFileSync(join(SKILL_ROOT, "BAND.md"), "utf-8");
    const result = parseBandMd(bandMd);
    expect(result.document.bandConfig).toBeDefined();
    const config = result.document.bandConfig!;
    expect(config).toHaveProperty("channels");
    expect((config.channels as any).allow).toBeDefined();
    expect((config.channels as any).deny).toBeDefined();
    expect(config).toHaveProperty("dm");
    expect(config).toHaveProperty("threads");
    expect(config).toHaveProperty("reactions");
    expect(config).toHaveProperty("files");
    expect(config).toHaveProperty("search");
  });

  test("band-config.schema.json exists and is valid", () => {
    const { existsSync, readFileSync } = require("fs");
    const schemaPath = join(SKILL_ROOT, "schemas", "band-config.schema.json");
    expect(existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(schema.type).toBe("object");
    expect(schema.properties.channels).toBeDefined();
    expect(schema.properties.dm).toBeDefined();
  });

  test("schema defs have $id fields", () => {
    const { readdirSync, readFileSync } = require("fs");
    const defsDir = join(SKILL_ROOT, "schemas", "defs");
    const files = readdirSync(defsDir).filter((f: string) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const schema = JSON.parse(readFileSync(join(defsDir, file), "utf-8"));
      expect(schema.$id).toBeDefined();
      expect(schema.$id).toBe(file);
    }
  });
});
