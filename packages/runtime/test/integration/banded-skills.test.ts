import { describe, expect, test } from "bun:test";
import { join } from "path";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { bandExec } from "../../src/banded-skills/exec";
import { validateBandedSkill } from "../../src/banded-skills/validator";

const FIXTURES = join(import.meta.dir, "../fixtures/banded-skills");

describe("banded skills integration (local-lima)", () => {
  test("execute echo-input script end-to-end", async () => {
    const resourceDir = join(
      FIXTURES,
      "valid-skill/scripts/resources/echo-input"
    );
    const result = await bandExec({
      resourceDir,
      args: { message: "hello world" },
      skillRoot: join(FIXTURES, "valid-skill"),
    });

    expect(result.success).toBe(true);
    expect(result.metrics).toBeDefined();
  });

  test("execute with input_path and output_path", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "banded-test-"));

    try {
      const inputPath = join(tempDir, "input.json");
      const outputPath = join(tempDir, "output.json");
      writeFileSync(inputPath, JSON.stringify({ message: "from file" }));

      const resourceDir = join(
        FIXTURES,
        "valid-skill/scripts/resources/echo-input"
      );
      const result = await bandExec({
        resourceDir,
        args: {},
        inputPath,
        outputPath,
        skillRoot: join(FIXTURES, "valid-skill"),
      });

      expect(result.success).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("--help fast path does not execute script", async () => {
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
    expect(typeof result.data).toBe("string");
    expect(result.data as string).toContain("echo-input");
    expect(result.data as string).toContain("message");
    // No metrics in help mode
    expect(result.metrics).toBeUndefined();
  });

  test("validate then execute flow", async () => {
    const skillRoot = join(FIXTURES, "valid-skill");

    // First validate
    const validation = validateBandedSkill(skillRoot);
    expect(validation.valid).toBe(true);

    // Then execute
    const resourceDir = join(skillRoot, "scripts/resources/echo-input");
    const result = await bandExec({
      resourceDir,
      args: { message: "validated" },
      skillRoot,
    });

    expect(result.success).toBe(true);
  });
});
