import { describe, expect, test } from "bun:test";
import { join } from "path";
import {
  discoverScripts,
  parseBandRunArgs,
  formatScriptList,
  type DiscoveredScript,
} from "../../src/band-run";

const fixturesDir = join(import.meta.dir, "..", "fixtures", "banded-skills");

describe("band-run", () => {
  describe("parseBandRunArgs", () => {
    test("parses script name as first non-flag argument", () => {
      const result = parseBandRunArgs(["my-script"]);
      expect(result.scriptName).toBe("my-script");
      expect(result.help).toBe(false);
      expect(result.list).toBe(false);
      expect(result.args).toEqual({});
    });

    test("parses --key=value style arguments", () => {
      const result = parseBandRunArgs(["my-script", "--limit=5", "--format=json"]);
      expect(result.scriptName).toBe("my-script");
      expect(result.args).toEqual({ limit: "5", format: "json" });
    });

    test("parses --key value style arguments", () => {
      const result = parseBandRunArgs(["my-script", "--limit", "5", "--format", "json"]);
      expect(result.scriptName).toBe("my-script");
      expect(result.args).toEqual({ limit: "5", format: "json" });
    });

    test("treats --flag without value as boolean true", () => {
      const result = parseBandRunArgs(["my-script", "--verbose"]);
      expect(result.args).toEqual({ verbose: "true" });
    });

    test("treats --flag followed by another --flag as boolean true", () => {
      const result = parseBandRunArgs(["my-script", "--verbose", "--dry-run"]);
      expect(result.args).toEqual({ verbose: "true", "dry-run": "true" });
    });

    test("parses --help flag", () => {
      const result = parseBandRunArgs(["my-script", "--help"]);
      expect(result.help).toBe(true);
      expect(result.scriptName).toBe("my-script");
    });

    test("parses -h flag", () => {
      const result = parseBandRunArgs(["my-script", "-h"]);
      expect(result.help).toBe(true);
      expect(result.scriptName).toBe("my-script");
    });

    test("parses --list flag", () => {
      const result = parseBandRunArgs(["--list"]);
      expect(result.list).toBe(true);
      expect(result.scriptName).toBe("");
    });

    test("parses --list with script name (list takes precedence in main)", () => {
      const result = parseBandRunArgs(["--list", "my-script"]);
      expect(result.list).toBe(true);
      expect(result.scriptName).toBe("my-script");
    });

    test("returns empty state for empty args", () => {
      const result = parseBandRunArgs([]);
      expect(result.scriptName).toBe("");
      expect(result.help).toBe(false);
      expect(result.list).toBe(false);
      expect(result.args).toEqual({});
    });

    test("only first non-flag argument is script name", () => {
      const result = parseBandRunArgs(["first", "second", "third"]);
      expect(result.scriptName).toBe("first");
      // "second" and "third" are ignored (not flags, not first positional)
    });

    test("parses mixed --key=value and --key value arguments", () => {
      const result = parseBandRunArgs([
        "my-script",
        "--limit=5",
        "--format",
        "json",
        "--verbose",
      ]);
      expect(result.scriptName).toBe("my-script");
      expect(result.args).toEqual({
        limit: "5",
        format: "json",
        verbose: "true",
      });
    });

    test("handles --help without a script name", () => {
      const result = parseBandRunArgs(["--help"]);
      expect(result.help).toBe(true);
      expect(result.scriptName).toBe("");
    });

    test("handles -h without a script name", () => {
      const result = parseBandRunArgs(["-h"]);
      expect(result.help).toBe(true);
      expect(result.scriptName).toBe("");
    });

    test("parses --key=value where value contains equals sign", () => {
      const result = parseBandRunArgs(["my-script", "--filter=key=val"]);
      expect(result.args).toEqual({ filter: "key=val" });
    });

    test("parses --key=value where value is empty string", () => {
      const result = parseBandRunArgs(["my-script", "--name="]);
      expect(result.args).toEqual({ name: "" });
    });

    test("--key value does not consume next argument if it starts with --", () => {
      const result = parseBandRunArgs(["my-script", "--first", "--second"]);
      expect(result.args).toEqual({ first: "true", second: "true" });
    });

    test("last --key=value wins for duplicate keys", () => {
      const result = parseBandRunArgs(["my-script", "--limit=5", "--limit=10"]);
      expect(result.args).toEqual({ limit: "10" });
    });

    test("script name before flags", () => {
      const result = parseBandRunArgs(["deploy", "--env=prod"]);
      expect(result.scriptName).toBe("deploy");
      expect(result.args).toEqual({ env: "prod" });
    });

    test("--help and --list can both be set", () => {
      const result = parseBandRunArgs(["--help", "--list"]);
      expect(result.help).toBe(true);
      expect(result.list).toBe(true);
    });
  });

  describe("discoverScripts", () => {
    test("discovers scripts from fixture skills directory", () => {
      const scripts = discoverScripts(fixturesDir);

      // valid-skill has: echo-input, transform-text, coerce-test
      expect(scripts.has("echo-input")).toBe(true);
      expect(scripts.has("transform-text")).toBe(true);
      expect(scripts.has("coerce-test")).toBe(true);

      // config-skill has: echo-config
      expect(scripts.has("echo-config")).toBe(true);

      // ref-skill has: ref-echo
      expect(scripts.has("ref-echo")).toBe(true);

      // invalid-skill has: broken, no-wrapper
      expect(scripts.has("broken")).toBe(true);
      expect(scripts.has("no-wrapper")).toBe(true);
    });

    test("discovered scripts have correct skillName", () => {
      const scripts = discoverScripts(fixturesDir);

      expect(scripts.get("echo-input")!.skillName).toBe("valid-skill");
      expect(scripts.get("transform-text")!.skillName).toBe("valid-skill");
      expect(scripts.get("coerce-test")!.skillName).toBe("valid-skill");
      expect(scripts.get("echo-config")!.skillName).toBe("config-skill");
      expect(scripts.get("ref-echo")!.skillName).toBe("ref-skill");
      expect(scripts.get("broken")!.skillName).toBe("invalid-skill");
    });

    test("discovered scripts have correct skillRoot", () => {
      const scripts = discoverScripts(fixturesDir);

      const echoInput = scripts.get("echo-input")!;
      expect(echoInput.skillRoot).toBe(join(fixturesDir, "valid-skill"));
    });

    test("discovered scripts have correct resourceDir", () => {
      const scripts = discoverScripts(fixturesDir);

      const echoInput = scripts.get("echo-input")!;
      expect(echoInput.resourceDir).toBe(
        join(fixturesDir, "valid-skill", "scripts", "resources", "echo-input")
      );
    });

    test("returns empty map for nonexistent directory", () => {
      const scripts = discoverScripts("/nonexistent/path/that/does/not/exist");
      expect(scripts.size).toBe(0);
    });

    test("returns empty map for directory with no skills", () => {
      // shared/ has no scripts/resources structure
      const scripts = discoverScripts(join(fixturesDir, "shared"));
      expect(scripts.size).toBe(0);
    });

    test("skips skills with no scripts/resources directory", () => {
      // shared/ is a skill dir but has no scripts/resources
      const scripts = discoverScripts(fixturesDir);
      // shared should be skipped, so no scripts from it
      // We verify by checking that scripts come only from known skills
      for (const [, info] of scripts) {
        expect(info.skillName).not.toBe("shared");
      }
    });

    test("returns empty map for empty directory", async () => {
      const { mkdtempSync } = await import("fs");
      const { tmpdir } = await import("os");
      const emptyDir = mkdtempSync(join(tmpdir(), "band-run-test-empty-"));
      const scripts = discoverScripts(emptyDir);
      expect(scripts.size).toBe(0);

      // Clean up
      const { rmSync } = await import("fs");
      rmSync(emptyDir, { recursive: true });
    });

    test("skips resource directories without run.sh", async () => {
      const { mkdtempSync, mkdirSync, writeFileSync } = await import("fs");
      const { tmpdir } = await import("os");

      const tempDir = mkdtempSync(join(tmpdir(), "band-run-test-no-runsh-"));
      const resourcesDir = join(tempDir, "my-skill", "scripts", "resources");
      const scriptWithRun = join(resourcesDir, "has-run");
      const scriptWithoutRun = join(resourcesDir, "no-run");

      mkdirSync(scriptWithRun, { recursive: true });
      mkdirSync(scriptWithoutRun, { recursive: true });
      writeFileSync(join(scriptWithRun, "run.sh"), "#!/bin/sh\necho hi");

      const scripts = discoverScripts(tempDir);
      expect(scripts.has("has-run")).toBe(true);
      expect(scripts.has("no-run")).toBe(false);
      expect(scripts.size).toBe(1);

      // Clean up
      const { rmSync } = await import("fs");
      rmSync(tempDir, { recursive: true });
    });

    test("discovers scripts from multiple skills", () => {
      const scripts = discoverScripts(fixturesDir);

      const skillNames = new Set<string>();
      for (const [, info] of scripts) {
        skillNames.add(info.skillName);
      }

      expect(skillNames.has("valid-skill")).toBe(true);
      expect(skillNames.has("config-skill")).toBe(true);
      expect(skillNames.has("ref-skill")).toBe(true);
      expect(skillNames.has("invalid-skill")).toBe(true);
    });
  });

  describe("formatScriptList", () => {
    test("returns 'No scripts found.' for empty map", () => {
      const result = formatScriptList(new Map());
      expect(result).toBe("No scripts found.");
    });

    test("formats single script", () => {
      const scripts = new Map<string, DiscoveredScript>();
      scripts.set("echo-input", {
        resourceDir: "/path/to/resources/echo-input",
        skillRoot: "/path/to/valid-skill",
        skillName: "valid-skill",
      });

      const result = formatScriptList(scripts);
      expect(result).toContain("Available scripts:");
      expect(result).toContain("valid-skill:");
      expect(result).toContain("echo-input");
    });

    test("groups scripts by skill name", () => {
      const scripts = new Map<string, DiscoveredScript>();
      scripts.set("echo-input", {
        resourceDir: "/path/to/resources/echo-input",
        skillRoot: "/path/to/valid-skill",
        skillName: "valid-skill",
      });
      scripts.set("transform-text", {
        resourceDir: "/path/to/resources/transform-text",
        skillRoot: "/path/to/valid-skill",
        skillName: "valid-skill",
      });
      scripts.set("echo-config", {
        resourceDir: "/path/to/resources/echo-config",
        skillRoot: "/path/to/config-skill",
        skillName: "config-skill",
      });

      const result = formatScriptList(scripts);
      expect(result).toContain("Available scripts:");
      expect(result).toContain("valid-skill:");
      expect(result).toContain("config-skill:");
      expect(result).toContain("echo-input");
      expect(result).toContain("transform-text");
      expect(result).toContain("echo-config");
    });

    test("sorts script names within each skill", () => {
      const scripts = new Map<string, DiscoveredScript>();
      scripts.set("z-script", {
        resourceDir: "/path/to/resources/z-script",
        skillRoot: "/path/to/my-skill",
        skillName: "my-skill",
      });
      scripts.set("a-script", {
        resourceDir: "/path/to/resources/a-script",
        skillRoot: "/path/to/my-skill",
        skillName: "my-skill",
      });
      scripts.set("m-script", {
        resourceDir: "/path/to/resources/m-script",
        skillRoot: "/path/to/my-skill",
        skillName: "my-skill",
      });

      const result = formatScriptList(scripts);
      const lines = result.split("\n");
      const scriptLines = lines.filter((l) => l.startsWith("    "));
      expect(scriptLines[0]).toBe("    a-script");
      expect(scriptLines[1]).toBe("    m-script");
      expect(scriptLines[2]).toBe("    z-script");
    });

    test("uses correct indentation format", () => {
      const scripts = new Map<string, DiscoveredScript>();
      scripts.set("deploy", {
        resourceDir: "/path/to/resources/deploy",
        skillRoot: "/path/to/ops",
        skillName: "ops",
      });

      const result = formatScriptList(scripts);
      const lines = result.split("\n");
      expect(lines[0]).toBe("Available scripts:");
      expect(lines[1]).toBe("");
      expect(lines[2]).toBe("  ops:");
      expect(lines[3]).toBe("    deploy");
      expect(lines[4]).toBe("");
    });

    test("formats output from real discovered scripts", () => {
      const scripts = discoverScripts(fixturesDir);
      const result = formatScriptList(scripts);

      expect(result).toContain("Available scripts:");
      expect(result).toContain("valid-skill:");
      expect(result).toContain("echo-input");
      expect(result).not.toBe("No scripts found.");
    });
  });
});
