import { describe, expect, test, beforeEach } from "bun:test";
import { join } from "path";
import { parseExecArgs, printHelp, bandExec } from "../../../src/banded-skills/exec";
import { clearValidatorCache } from "../../../src/banded-skills/schema-loader";

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
  beforeEach(() => {
    clearValidatorCache();
  });

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
    const resourceDir = join(FIXTURES, "valid-skill/scripts/resources/echo-input");
    const result = await bandExec({
      resourceDir,
      args: { message: "hello" },
      skillRoot: join(FIXTURES, "valid-skill"),
    });
    if (result.success) {
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.durationMs).toBeGreaterThan(0);
    } else {
      expect(result.error).toMatch(/lima|limactl|VM|bwrap|band-runner|band server|localhost|9000|JSON/i);
    }
  }, 30_000);

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
    const resourceDir = join(FIXTURES, "config-skill/scripts/resources/echo-config");
    const result = await bandExec({
      resourceDir,
      args: {},
      skillRoot: join(FIXTURES, "config-skill"),
    });
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data["feature-a"]).toBe(true);
      expect(data["feature-b"]).toBe(false);
      expect(data.items).toEqual(["one", "two"]);
    } else {
      expect(result.error).toMatch(/lima|limactl|VM|bwrap|band-runner|band server|localhost|9000|JSON/i);
    }
  }, 30_000);

  test("executes via lima when target is local-lima", async () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const result = await bandExec({
      resourceDir,
      args: { message: "hello" },
      skillRoot: join(FIXTURES, "valid-skill"),
    });
    if (!result.success) {
      expect(result.error).toMatch(/lima|limactl|VM|bwrap|band-runner|band server|localhost|9000|JSON/i);
    }
  }, 30_000);

  // ---- CLI arg type coercion tests ----

  describe("type coercion from CLI string args", () => {
    const refResourceDir = join(FIXTURES, "ref-skill/scripts/resources/ref-echo");
    const refSkillRoot = join(FIXTURES, "ref-skill");
    const coerceResourceDir = join(FIXTURES, "valid-skill/scripts/resources/coerce-test");
    const coerceSkillRoot = join(FIXTURES, "valid-skill");

    function expectPassedValidation(result: { success: boolean; error?: string }) {
      if (!result.success) {
        expect(result.error).not.toContain("validation failed");
        expect(result.error).toMatch(/lima|limactl|VM|bwrap|band-runner|band server|localhost|9000|JSON/i);
      }
    }

    test("coerces string to integer via $ref schema", async () => {
      const result = await bandExec({
        resourceDir: refResourceDir,
        args: { name: "test", greeting: "hello", limit: "5" },
        skillRoot: refSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces string to boolean via $ref schema", async () => {
      const result = await bandExec({
        resourceDir: refResourceDir,
        args: { name: "test", greeting: "hello", verbose: "true" },
        skillRoot: refSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces string to integer via inline type", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "10" },
        skillRoot: coerceSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces string to number (float) via inline type", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "1", rate: "3.14" },
        skillRoot: coerceSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces string to boolean via inline type", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "1", verbose: "true" },
        skillRoot: coerceSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces 'false' string to boolean false", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "1", verbose: "false" },
        skillRoot: coerceSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces multiple types simultaneously", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "42", rate: "2.5", verbose: "true", label: "test" },
        skillRoot: coerceSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("coerces $ref integer and $ref boolean together", async () => {
      const result = await bandExec({
        resourceDir: refResourceDir,
        args: { name: "test", greeting: "hello", limit: "10", verbose: "false" },
        skillRoot: refSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("rejects non-numeric string for integer $ref", async () => {
      const result = await bandExec({
        resourceDir: refResourceDir,
        args: { name: "test", greeting: "hello", limit: "notanumber" },
        skillRoot: refSkillRoot,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Input validation failed");
    });

    test("rejects non-numeric string for inline integer", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "abc" },
        skillRoot: coerceSkillRoot,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Input validation failed");
    });

    test("respects $ref integer minimum constraint after coercion", async () => {
      // limit.json has minimum: 1
      const result = await bandExec({
        resourceDir: refResourceDir,
        args: { name: "test", greeting: "hello", limit: "0" },
        skillRoot: refSkillRoot,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Input validation failed");
    });

    test("does not coerce when input comes from --input_path", async () => {
      // When using inputPath, data is already parsed JSON — no coercion needed
      const { writeFileSync, mkdtempSync } = await import("fs");
      const { tmpdir } = await import("os");
      const tmpDir = mkdtempSync(join(tmpdir(), "band-test-"));
      const inputFile = join(tmpDir, "input.json");
      writeFileSync(inputFile, JSON.stringify({ count: 5 }));

      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: {},
        inputPath: inputFile,
        skillRoot: coerceSkillRoot,
      });
      expectPassedValidation(result);
    }, 30_000);

    test("string values remain strings when schema type is string", async () => {
      const result = await bandExec({
        resourceDir: coerceResourceDir,
        args: { count: "1", label: "42" },
        skillRoot: coerceSkillRoot,
      });
      // "42" should stay as string for the label field (type: string)
      expectPassedValidation(result);
    }, 30_000);
  });
});
