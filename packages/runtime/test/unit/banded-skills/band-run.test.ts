import { describe, expect, test } from "bun:test";
import { join } from "path";
import {
  discoverScripts,
  parseBandRunArgs,
  formatScriptList,
  type DiscoveredScript,
} from "../../../src/band-run";

const FIXTURES = join(import.meta.dir, "../../fixtures/banded-skills");

describe("discoverScripts", () => {
  test("discovers scripts from skills directory", () => {
    // Use the fixtures dir as a "skills" directory — each subdirectory is a "skill"
    const scripts = discoverScripts(FIXTURES);

    // valid-skill has echo-input and transform-text
    expect(scripts.has("echo-input")).toBe(true);
    expect(scripts.has("transform-text")).toBe(true);

    const echoInput = scripts.get("echo-input")!;
    expect(echoInput.skillName).toBe("valid-skill");
    expect(echoInput.resourceDir).toBe(
      join(FIXTURES, "valid-skill/scripts/resources/echo-input")
    );
    expect(echoInput.skillRoot).toBe(join(FIXTURES, "valid-skill"));
  });

  test("returns empty map for nonexistent directory", () => {
    const scripts = discoverScripts("/nonexistent/path");
    expect(scripts.size).toBe(0);
  });

  test("returns empty map for directory with no skills", () => {
    // shared/ has no scripts/resources structure
    const scripts = discoverScripts(join(FIXTURES, "shared"));
    expect(scripts.size).toBe(0);
  });

  test("discovers ref-skill scripts alongside valid-skill", () => {
    const scripts = discoverScripts(FIXTURES);

    // valid-skill has echo-input
    const echoInput = scripts.get("echo-input");
    expect(echoInput).toBeDefined();
    expect(echoInput!.skillName).toBe("valid-skill");

    // ref-skill has ref-echo (renamed to avoid collision)
    const refEcho = scripts.get("ref-echo");
    expect(refEcho).toBeDefined();
    expect(refEcho!.skillName).toBe("ref-skill");
  });
});

describe("parseBandRunArgs", () => {
  test("parses script name as first non-flag arg", () => {
    const parsed = parseBandRunArgs(["gist-list"]);
    expect(parsed.scriptName).toBe("gist-list");
    expect(parsed.list).toBe(false);
    expect(parsed.help).toBe(false);
  });

  test("parses --key=value args", () => {
    const parsed = parseBandRunArgs([
      "gist-list",
      "--limit=5",
      "--format=json",
    ]);
    expect(parsed.scriptName).toBe("gist-list");
    expect(parsed.args.limit).toBe("5");
    expect(parsed.args.format).toBe("json");
  });

  test("parses --key value args", () => {
    const parsed = parseBandRunArgs(["gist-list", "--limit", "5"]);
    expect(parsed.args.limit).toBe("5");
  });

  test("parses --list flag", () => {
    const parsed = parseBandRunArgs(["--list"]);
    expect(parsed.list).toBe(true);
    expect(parsed.scriptName).toBe("");
  });

  test("parses --help flag", () => {
    const parsed = parseBandRunArgs(["gist-list", "--help"]);
    expect(parsed.help).toBe(true);
    expect(parsed.scriptName).toBe("gist-list");
  });

  test("parses -h flag", () => {
    const parsed = parseBandRunArgs(["gist-list", "-h"]);
    expect(parsed.help).toBe(true);
  });

  test("handles empty args", () => {
    const parsed = parseBandRunArgs([]);
    expect(parsed.scriptName).toBe("");
    expect(parsed.list).toBe(false);
    expect(parsed.help).toBe(false);
    expect(Object.keys(parsed.args)).toHaveLength(0);
  });

  test("boolean flag (no value)", () => {
    const parsed = parseBandRunArgs(["gist-list", "--verbose"]);
    expect(parsed.args.verbose).toBe("true");
  });
});

describe("formatScriptList", () => {
  test("formats empty list", () => {
    const scripts = new Map<string, DiscoveredScript>();
    const output = formatScriptList(scripts);
    expect(output).toBe("No scripts found.");
  });

  test("groups scripts by skill", () => {
    const scripts = new Map<string, DiscoveredScript>([
      [
        "gist-list",
        {
          resourceDir: "/skills/github/scripts/resources/gist-list",
          skillRoot: "/skills/github",
          skillName: "github",
        },
      ],
      [
        "issue-list",
        {
          resourceDir: "/skills/github/scripts/resources/issue-list",
          skillRoot: "/skills/github",
          skillName: "github",
        },
      ],
    ]);

    const output = formatScriptList(scripts);
    expect(output).toContain("Available scripts:");
    expect(output).toContain("github:");
    expect(output).toContain("gist-list");
    expect(output).toContain("issue-list");
  });

  test("sorts scripts within a skill", () => {
    const scripts = new Map<string, DiscoveredScript>([
      [
        "z-script",
        {
          resourceDir: "/r/z",
          skillRoot: "/s",
          skillName: "test",
        },
      ],
      [
        "a-script",
        {
          resourceDir: "/r/a",
          skillRoot: "/s",
          skillName: "test",
        },
      ],
    ]);

    const output = formatScriptList(scripts);
    const aIdx = output.indexOf("a-script");
    const zIdx = output.indexOf("z-script");
    expect(aIdx).toBeLessThan(zIdx);
  });
});
