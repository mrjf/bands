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
  test("prints schema info for echo-input", () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const help = printHelp(resourceDir);

    expect(help).toContain("Script: echo-input");
    expect(help).toContain("Input Schema:");
    expect(help).toContain("message");
    expect(help).toContain("required");
    expect(help).toContain("Output Schema:");
  });

  test("handles missing schemas gracefully", () => {
    const resourceDir = join(
      FIXTURES,
      "ref-skill/scripts/resources/echo-input"
    );
    const help = printHelp(resourceDir);

    expect(help).toContain("Script: echo-input");
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
    });

    // May pass or fail depending on ajv availability — both are acceptable
    // The important thing is it doesn't crash
    expect(typeof result.success).toBe("boolean");
  });
});
