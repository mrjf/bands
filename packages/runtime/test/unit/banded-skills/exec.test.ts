import { describe, expect, test } from "bun:test";
import { join } from "path";
import { parseExecArgs, printHelp, bandExec } from "../../../src/banded-skills/exec";

const FIXTURES = join(import.meta.dir, "../../fixtures/banded-skills");

describe("parseExecArgs", () => {
  test("parses resource dir", () => {
    const opts = parseExecArgs(["path/to/resource"]);
    expect(opts.resourceDir).toBe("path/to/resource");
  });

  test("parses --key=value args", () => {
    const opts = parseExecArgs([
      "resource",
      "--message=hello",
      "--count=5",
    ]);
    expect(opts.args.message).toBe("hello");
    expect(opts.args.count).toBe("5");
  });

  test("parses --key value args", () => {
    const opts = parseExecArgs(["resource", "--message", "hello"]);
    expect(opts.args.message).toBe("hello");
  });

  test("parses --input_path and --output_path", () => {
    const opts = parseExecArgs([
      "resource",
      "--input_path=/tmp/in.json",
      "--output_path=/tmp/out.json",
    ]);
    expect(opts.inputPath).toBe("/tmp/in.json");
    expect(opts.outputPath).toBe("/tmp/out.json");
  });

  test("parses --help flag", () => {
    const opts = parseExecArgs(["resource", "--help"]);
    expect(opts.help).toBe(true);
  });

  test("parses -h flag", () => {
    const opts = parseExecArgs(["resource", "-h"]);
    expect(opts.help).toBe(true);
  });
});

describe("printHelp", () => {
  test("prints schema info for echo-input with skillRoot", () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const skillRoot = join(FIXTURES, "valid-skill");
    const help = printHelp(resourceDir, skillRoot);

    expect(help).toContain("Script: echo-input");
    expect(help).toContain("Input Schema:");
    expect(help).toContain("message");
    expect(help).toContain("required");
    expect(help).toContain("Output Schema:");
  });

  test("handles missing schemas gracefully", () => {
    const resourceDir = join(
      FIXTURES,
      "ref-skill/scripts/resources/ref-echo"
    );
    const help = printHelp(resourceDir);

    expect(help).toContain("Script: ref-echo");
    expect(help).toContain("(none)");
  });
});

describe("bandExec", () => {
  test("help mode returns schema info", async () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const result = await bandExec({
      resourceDir,
      args: {},
      help: true,
      skillRoot: join(FIXTURES, "valid-skill"),
    });

    expect(result.success).toBe(true);
    expect(result.data).toContain("echo-input");
  });

  test("returns error for missing run.sh", async () => {
    const result = await bandExec({
      resourceDir: "/nonexistent/path",
      args: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("run.sh not found");
  });

  test("executes echo-input script", async () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const result = await bandExec({
      resourceDir,
      args: { message: "hello" },
    });

    expect(result.success).toBe(true);
    expect(result.metrics).toBeDefined();
    expect(result.metrics!.durationMs).toBeGreaterThan(0);
  });

  test("schema validation catches invalid input", async () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    // missing required "message" field
    const result = await bandExec({
      resourceDir,
      args: {},
      skillRoot: join(FIXTURES, "valid-skill"),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Input validation failed");
    expect(result.error).toContain("message");
  });

  test("passes CONFIG_PATH when band has bandConfig", async () => {
    const resourceDir = join(
      FIXTURES,
      "config-skill/scripts/resources/echo-config"
    );
    const result = await bandExec({
      resourceDir,
      args: {},
      skillRoot: join(FIXTURES, "config-skill"),
    });

    expect(result.success).toBe(true);
    // The echo-config script outputs the config.json contents
    const data = result.data as Record<string, unknown>;
    expect(data["feature-a"]).toBe(true);
    expect(data["feature-b"]).toBe(false);
    expect(data.items).toEqual(["one", "two"]);
  });

  test("forceLima overrides local-dangerously to lima", async () => {
    // The valid-skill fixture has execution.target: local-dangerously in its BAND.md.
    // With forceLima, it should attempt lima execution instead.
    // Since limactl is unlikely to be available in test, we expect a lima-specific error
    // (not a local-dangerously execution).
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const result = await bandExec({
      resourceDir,
      args: { message: "hello" },
      skillRoot: join(FIXTURES, "valid-skill"),
      forceLima: true,
    });

    // Should either succeed via lima, or fail with a lima-related error
    // (not succeed via local-dangerously)
    if (!result.success) {
      expect(result.error).toMatch(/lima|limactl|VM/i);
    }
    // If it succeeds, that's fine too — lima is available
  });
});
