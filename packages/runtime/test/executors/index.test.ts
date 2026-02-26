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
  LocalDangerousExecutor,
  DockerExecutor,
  CloudflareExecutor,
} from "../../src/executors";
import type { BandDocument, ExecutionTarget } from "@bands/format";

// Test band for execution tests
const createTestBand = (target?: ExecutionTarget): BandDocument => ({
  band: "test-band",
  version: 1,
  icon: "🧪",
  description: "Test band for executor tests",
  execution: target ? { target } : undefined,
  returns: {
    supports: ["sync"],
    default: "sync",
  },
});

describe("Executor Registry", () => {
  test("should have all three executors registered", () => {
    expect(executorRegistry.get("local-dangerously")).toBeDefined();
    expect(executorRegistry.get("local-docker")).toBeDefined();
    expect(executorRegistry.get("cloudflare")).toBeDefined();
  });

  test("should create executor instances", () => {
    const localDangerous = executorRegistry.create("local-dangerously");
    expect(localDangerous).toBeInstanceOf(LocalDangerousExecutor);

    const docker = executorRegistry.create("local-docker");
    expect(docker).toBeInstanceOf(DockerExecutor);

    const cloudflare = executorRegistry.create("cloudflare");
    expect(cloudflare).toBeInstanceOf(CloudflareExecutor);
  });

  test("should return undefined for unknown targets", () => {
    const unknown = executorRegistry.create("unknown-target" as ExecutionTarget);
    expect(unknown).toBeUndefined();
  });

  test("should cache executor instances", () => {
    const first = executorRegistry.create("local-dangerously");
    const second = executorRegistry.create("local-dangerously");
    expect(first).toBe(second);
  });

  test("clearCache should allow new instance creation", () => {
    const first = executorRegistry.create("local-dangerously");
    executorRegistry.clearCache();
    const second = executorRegistry.create("local-dangerously");
    expect(first).not.toBe(second);
  });
});

describe("LocalDangerousExecutor", () => {
  test("should always be available", async () => {
    const executor = new LocalDangerousExecutor();
    expect(await executor.isAvailable()).toBe(true);
  });

  test("should have correct name and target", () => {
    const executor = new LocalDangerousExecutor();
    expect(executor.name).toBe("local-dangerous");
    expect(executor.target).toBe("local-dangerously");
  });

  test("should execute a simple band", async () => {
    const executor = new LocalDangerousExecutor();
    const band = createTestBand();

    const result = await executor.execute({
      band,
      payload: { test: "data" },
    });

    expect(result.success).toBe(true);
    expect(result.target).toBe("local-dangerously");
    expect(result.metrics).toBeDefined();
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("should return input with band info", async () => {
    const executor = new LocalDangerousExecutor();
    const band = createTestBand();

    const result = await executor.execute({
      band,
      payload: { message: "hello" },
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("success", true);
    expect(result.data).toHaveProperty("band", "test-band");
    expect(result.data).toHaveProperty("input");
    expect((result.data as { input: unknown }).input).toEqual({ message: "hello" });
  });

  test("should track execution metrics", async () => {
    const executor = new LocalDangerousExecutor();
    const band = createTestBand();

    const result = await executor.execute({
      band,
      payload: { data: "test" },
    });

    expect(result.metrics.startupMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.inputBytes).toBeGreaterThan(0);
    expect(result.metrics.outputBytes).toBeGreaterThan(0);
  });

});

describe("DockerExecutor", () => {
  test("should have correct name and target", () => {
    const executor = new DockerExecutor();
    expect(executor.name).toBe("docker");
    expect(executor.target).toBe("local-docker");
  });

  test("isAvailable should check for Docker", async () => {
    const executor = new DockerExecutor();
    const available = await executor.isAvailable();
    // Result depends on whether Docker is installed
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
    // Result depends on whether wrangler and credentials are configured
    expect(typeof available).toBe("boolean");
  });
});

describe("getExecutor", () => {
  test("should return executor for local-dangerously", async () => {
    const executor = await getExecutor("local-dangerously");
    expect(executor).toBeInstanceOf(LocalDangerousExecutor);
  });

  test("should throw for unregistered target", async () => {
    await expect(getExecutor("unknown" as ExecutionTarget)).rejects.toThrow(
      /No executor registered/
    );
  });
});

describe("listAvailableTargets", () => {
  test("should always include local-dangerously", async () => {
    const targets = await listAvailableTargets();
    expect(targets).toContain("local-dangerously");
  });

  test("should return an array of ExecutionTarget values", async () => {
    const targets = await listAvailableTargets();
    expect(Array.isArray(targets)).toBe(true);
    expect(targets.length).toBeGreaterThanOrEqual(1);
  });
});

describe("isTargetAvailable", () => {
  test("should return true for local-dangerously", async () => {
    expect(await isTargetAvailable("local-dangerously")).toBe(true);
  });

  test("should return boolean for all targets", async () => {
    const targets: ExecutionTarget[] = ["local-dangerously", "local-docker", "cloudflare"];
    for (const target of targets) {
      const available = await isTargetAvailable(target);
      expect(typeof available).toBe("boolean");
    }
  });
});

describe("executeBand", () => {
  test("should use band's configured target", async () => {
    const band = createTestBand("local-dangerously");
    const result = await executeBand(band, { test: true });

    expect(result.success).toBe(true);
    expect(result.target).toBe("local-dangerously");
  });

  test("should allow target override", async () => {
    const band = createTestBand("cloudflare"); // Band says cloudflare
    // But we override to local-dangerously
    const result = await executeBand(band, { test: true }, { target: "local-dangerously" });

    expect(result.success).toBe(true);
    expect(result.target).toBe("local-dangerously");
  });

  test("should default to local-dangerously when no target specified", async () => {
    const band: BandDocument = {
      band: "no-target-band",
      version: 1,
      icon: "🎯",
    };

    const result = await executeBand(band, {});
    expect(result.success).toBe(true);
    expect(result.target).toBe("local-dangerously");
  });

  test("should pass payload correctly", async () => {
    const band = createTestBand();
    const payload = { key: "value", number: 42, nested: { a: 1 } };

    const result = await executeBand(band, payload);

    expect(result.success).toBe(true);
    expect((result.data as { input: unknown }).input).toEqual(payload);
  });

  test("should include metrics in result", async () => {
    const band = createTestBand();
    const result = await executeBand(band, {});

    expect(result.metrics).toBeDefined();
    expect(typeof result.metrics.startupMs).toBe("number");
    expect(typeof result.metrics.durationMs).toBe("number");
    expect(typeof result.metrics.inputBytes).toBe("number");
    expect(typeof result.metrics.outputBytes).toBe("number");
  });
});

describe("Execution Target Selection", () => {
  test("priority: options.target > band.execution.target > default", async () => {
    // Test 1: options.target takes precedence
    const bandWithTarget = createTestBand("cloudflare");
    const result1 = await executeBand(
      bandWithTarget,
      {},
      { target: "local-dangerously" }
    );
    expect(result1.target).toBe("local-dangerously");

    // Test 2: band.execution.target used when no override
    const result2 = await executeBand(
      createTestBand("local-dangerously"),
      {}
    );
    expect(result2.target).toBe("local-dangerously");

    // Test 3: default when nothing specified
    const bandNoTarget: BandDocument = {
      band: "no-target",
      version: 1,
      icon: "🎯",
    };
    const result3 = await executeBand(bandNoTarget, {});
    expect(result3.target).toBe("local-dangerously");
  });
});
