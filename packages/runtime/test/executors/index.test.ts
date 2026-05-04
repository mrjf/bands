/**
 * Tests for the executor system
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  executorRegistry,
  getExecutor,
  executeBand,
  listAvailableTargets,
  isTargetAvailable,
  CloudflareExecutor,
  LimaExecutor,
} from "../../src/executors";
import type { BandDocument, ExecutionTarget } from "@bands/format";

const createTestBand = (target?: ExecutionTarget): BandDocument => ({
  band: "test-band",
  icon: "🧪",
  description: "Test band for executor tests",
  execution: target ? { target } : undefined,
});

describe("Executor Registry", () => {
  test("should have all executors registered", () => {
    expect(executorRegistry.get("local-lima")).toBeDefined();
    expect(executorRegistry.get("cloudflare")).toBeDefined();
  });

  test("should create executor instances", () => {
    const lima = executorRegistry.create("local-lima");
    expect(lima).toBeInstanceOf(LimaExecutor);
    const cloudflare = executorRegistry.create("cloudflare");
    expect(cloudflare).toBeInstanceOf(CloudflareExecutor);
  });

  test("should return undefined for unknown targets", () => {
    const unknown = executorRegistry.create("unknown-target" as ExecutionTarget);
    expect(unknown).toBeUndefined();
  });

  test("should cache executor instances", () => {
    const first = executorRegistry.create("local-lima");
    const second = executorRegistry.create("local-lima");
    expect(first).toBe(second);
  });

  test("clearCache should allow new instance creation", () => {
    const first = executorRegistry.create("local-lima");
    executorRegistry.clearCache();
    const second = executorRegistry.create("local-lima");
    expect(first).not.toBe(second);
  });
});

describe("LimaExecutor", () => {
  test("should have correct name and target", () => {
    const executor = new LimaExecutor();
    expect(executor.name).toBe("local-lima");
    expect(executor.target).toBe("local-lima");
  });

  test("isAvailable should check for Lima VM", async () => {
    const executor = new LimaExecutor();
    const available = await executor.isAvailable();
    expect(typeof available).toBe("boolean");
  });
});

describe("CloudflareExecutor", () => {
  test("should have correct name and target", () => {
    const executor = new CloudflareExecutor();
    expect(executor.name).toBe("cloudflare");
    expect(executor.target).toBe("cloudflare");
  });

  test("isAvailable should check for wrangler and credentials", async () => {
    const executor = new CloudflareExecutor();
    const available = await executor.isAvailable();
    expect(typeof available).toBe("boolean");
  });
});

describe("getExecutor", () => {
  test("should throw for unregistered target", async () => {
    await expect(getExecutor("unknown" as ExecutionTarget)).rejects.toThrow(
      /No executor registered/
    );
  });
});

describe("listAvailableTargets", () => {
  test("should return an array of ExecutionTarget values", async () => {
    const targets = await listAvailableTargets();
    expect(Array.isArray(targets)).toBe(true);
  });
});

describe("isTargetAvailable", () => {
  test("should return boolean for all targets", async () => {
    const targets: ExecutionTarget[] = ["local-lima", "cloudflare"];
    for (const target of targets) {
      const available = await isTargetAvailable(target);
      expect(typeof available).toBe("boolean");
    }
  });
});

describe("executeBand", () => {
  test("should throw when no target specified", async () => {
    const band: BandDocument = {
      band: "no-target-band",
      icon: "🎯",
      description: "Test band",
    };
    await expect(executeBand(band, {})).rejects.toThrow(
      /No execution target specified/
    );
  });

  test("should include metrics in result when target available", async () => {
    const band = createTestBand("local-lima");
    const available = await isTargetAvailable("local-lima");
    if (!available) {
      await expect(executeBand(band, {})).rejects.toThrow(/not available/);
      return;
    }
    const result = await executeBand(band, {});
    expect(result.metrics).toBeDefined();
    expect(typeof result.metrics.startupMs).toBe("number");
    expect(typeof result.metrics.durationMs).toBe("number");
    expect(typeof result.metrics.inputBytes).toBe("number");
    expect(typeof result.metrics.outputBytes).toBe("number");
  });
});

describe("executeBand contract enforcement", () => {
  test("rejects input that violates contract.input", async () => {
    const band: BandDocument = {
      band: "contract-test",
      icon: "📋",
      description: "Test band",
      execution: { target: "local-lima" },
      contract: {
        input: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    };
    const result = await executeBand(band, { wrong: 123 });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("CONTRACT_INPUT_INVALID");
    expect(result.error?.message).toContain("contract.input validation failed");
  });

  test("throws on unresolvable string schema refs (missing file, URL)", async () => {
    const bandMissingFile: BandDocument = {
      band: "contract-test",
      icon: "📋",
      description: "Test band",
      execution: { target: "local-lima" },
      contract: { input: "./nonexistent/schema.json" },
    };
    await expect(executeBand(bandMissingFile, { anything: true })).rejects.toThrow(/not found/);

    const bandUrl: BandDocument = {
      band: "contract-test",
      icon: "📋",
      description: "Test band",
      execution: { target: "local-lima" },
      contract: { input: "https://example.com/output.json" },
    };
    await expect(executeBand(bandUrl, { anything: true })).rejects.toThrow(/not yet supported/);
  });

  test("allows valid input through contract check", async () => {
    const band: BandDocument = {
      band: "contract-test",
      icon: "📋",
      description: "Test band",
      execution: { target: "local-lima" },
      contract: {
        input: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    };
    const available = await isTargetAvailable("local-lima");
    if (!available) {
      await expect(executeBand(band, { name: "alice" })).rejects.toThrow(/not available/);
      return;
    }
    const result = await executeBand(band, { name: "alice" });
    expect(result.success).toBe(true);
  });
});

describe("Execution Target Selection", () => {
  test("requires explicit target — no default", async () => {
    const bandNoTarget: BandDocument = {
      band: "no-target",
      icon: "🎯",
      description: "Test band",
    };
    await expect(executeBand(bandNoTarget, {})).rejects.toThrow(
      /No execution target specified/
    );
  });

  test("options.target overrides band.execution.target", async () => {
    const band = createTestBand("cloudflare");
    const available = await isTargetAvailable("local-lima");
    if (!available) {
      await expect(
        executeBand(band, {}, { target: "local-lima" })
      ).rejects.toThrow(/not available/);
      return;
    }
    const result = await executeBand(band, {}, { target: "local-lima" });
    expect(result.target).toBe("local-lima");
  });
});
