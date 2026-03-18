/**
 * Shared Integration Test Suite
 *
 * This suite runs the same tests across all execution targets.
 * Each executor gets identical tests to ensure consistent behavior.
 *
 * Tests verify that permission enforcement works the same way everywhere:
 * - CLI command filtering (allow/deny)
 * - Filesystem read/write restrictions
 * - Network egress restrictions
 * - Resource limits (timeout, memory, output size)
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import {
  IntegrationTestHarness,
  getExampleBandPath,
} from "./runner";
import type { ExecutionTarget } from "@bands/format";

// Track skipped targets for summary
const skippedTargets = new Set<string>();

/**
 * Print summary of skipped executors.
 * Call this at the end of your test file.
 */
export function printSkippedSummary() {
  if (skippedTargets.size > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("                        SKIPPED EXECUTORS");
    console.log("=".repeat(80));
    console.log("\nThe following executors were not available and their tests were skipped:\n");
    for (const target of skippedTargets) {
      let reason = "";
      switch (target) {
        case "local-lima":
          reason = "Lima VM not running (limactl start bands-executor)";
          break;
        case "cloudflare":
          reason = "Wrangler not installed or no network/credentials";
          break;
        default:
          reason = "Executor not available";
      }
      console.log(`  • ${target}: ${reason}`);
    }
    console.log("\n" + "=".repeat(80) + "\n");
  }
}

/**
 * Run the full integration test suite for a given execution target.
 */
export function runExecutorSuite(target: ExecutionTarget, options: {
  timeout?: number;
  skipIfUnavailable?: boolean;
} = {}) {
  const { timeout = 60000, skipIfUnavailable = true } = options;

  describe(`${target} Executor`, () => {
    const harness = new IntegrationTestHarness({
      name: `${target}-integration`,
      bandPath: getExampleBandPath("minimal"),
      target,
      timeout,
    });

    let available = false;

    beforeAll(async () => {
      available = await harness.checkAvailability();
      if (!available && !skipIfUnavailable) {
        throw new Error(`${target} executor is not available`);
      }
      if (!available) {
        skippedTargets.add(target);
      }
      if (available) {
        await harness.init();
      }
    }, timeout); // Use the same timeout for beforeAll

    afterAll(async () => {
      if (available) {
        await harness.cleanup();
      }
    });

    // Helper to skip tests when executor unavailable
    const skipIf = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  ⏭  Skipping: ${msg}`);
        return true;
      }
      return false;
    };

    describe("Basic Execution", () => {
      test("executes a simple band", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ message: "hello" });

        expect(result.target).toBe(target);
        expect(result.success).toBe(true);
        // Duration might be 0 for very fast executions, just check it exists
        expect(typeof result.metrics.durationMs).toBe("number");
      }, timeout);

      test("returns execution metrics", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ data: "metrics test" });

        expect(result.metrics).toBeDefined();
        expect(typeof result.metrics.durationMs).toBe("number");
        expect(typeof result.metrics.startupMs).toBe("number");
        expect(typeof result.metrics.inputBytes).toBe("number");
        expect(typeof result.metrics.outputBytes).toBe("number");
      }, timeout);

      test("handles complex JSON payloads", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const payload = {
          string: "hello",
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3, "four", { five: 5 }],
          nested: { a: 1, b: { c: 2, d: { e: 3 } } },
        };

        const result = await harness.execute(payload);
        expect(result.success).toBe(true);
      }, timeout);

      test("handles empty payload", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({});
        expect(result.success).toBe(true);
      }, timeout);

      test("handles large payloads", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const largePayload = {
          data: "x".repeat(10000),
          items: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            value: `item-${i}`,
            nested: { a: i * 2, b: `nested-${i}` },
          })),
        };

        const result = await harness.execute(largePayload);
        expect(result.success).toBe(true);
        expect(result.metrics.inputBytes).toBeGreaterThan(10000);
      }, timeout);
    });

    describe("Timeouts", () => {
      test("respects timeout limits", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ test: "timeout" }, timeout);
        expect(result.metrics.durationMs).toBeLessThan(timeout);
      }, timeout);

      test("completes within reasonable time", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const start = Date.now();
        const result = await harness.execute({ test: "speed" });
        const elapsed = Date.now() - start;

        expect(result.success).toBe(true);
        // Should complete much faster than the timeout
        expect(elapsed).toBeLessThan(timeout);
      }, timeout);
    });

    describe("Sequential Execution", () => {
      test("handles multiple sequential requests", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const results = [];
        for (let i = 0; i < 3; i++) {
          const result = await harness.execute({ iteration: i });
          results.push(result);
        }

        for (const result of results) {
          expect(result.success).toBe(true);
          expect(result.target).toBe(target);
        }
      }, timeout * 3); // Allow extra time for multiple requests
    });

    describe("Target Reporting", () => {
      test("correctly reports execution target", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ test: "target" });

        expect(result.target).toBe(target);
      }, timeout);
    });
  });
}

/**
 * Run permission enforcement tests for a given execution target.
 * These tests verify that all executors enforce the same restrictions.
 */
export function runPermissionSuite(target: ExecutionTarget, options: {
  timeout?: number;
  skipIfUnavailable?: boolean;
} = {}) {
  const { timeout = 60000, skipIfUnavailable = true } = options;

  describe(`${target} Permission Enforcement`, () => {
    let available = false;

    // Helper to skip tests when executor unavailable
    const skipIf = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  ⏭  Skipping: ${msg}`);
        return true;
      }
      return false;
    };

    describe("CLI Command Filtering", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-cli-test`,
        bandPath: getExampleBandPath("code-runner"), // Has cli allow/deny
        target,
        timeout,
      });

      beforeAll(async () => {
        available = await harness.checkAvailability();
        if (available) await harness.init();
      });

      afterAll(async () => {
        if (available) await harness.cleanup();
      });

      test("allows commands in allow list", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // code-runner allows: python *, node *, ls *, echo *
        const result = await harness.execute({
          command: "echo hello",
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
      });

      test("blocks commands not in allow list", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // code-runner doesn't allow curl
        const result = await harness.execute({
          command: "curl http://example.com",
          expectAllowed: false,
        });

        // Should fail or return denied error
        expect(result.success).toBe(false);
        expect(result.error?.code).toMatch(/DENIED|PERMISSION|BLOCKED/i);
      });

      test("blocks commands in deny list even if they match allow", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // code-runner denies: rm -rf *, sudo *
        const result = await harness.execute({
          command: "sudo ls",
          expectAllowed: false,
        });

        expect(result.success).toBe(false);
      });
    });

    describe("Filesystem Restrictions", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-fs-test`,
        bandPath: getExampleBandPath("data-analyst"), // Has read/write restrictions
        target,
        timeout,
      });

      beforeAll(async () => {
        available = await harness.checkAvailability();
        if (available) await harness.init();
      });

      afterAll(async () => {
        if (available) await harness.cleanup();
      });

      test("allows reading from allowed paths", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // data-analyst allows read: /tmp/**, ./data/**
        const result = await harness.execute({
          readPath: "/tmp/test.txt",
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
      });

      test("blocks reading from disallowed paths", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // data-analyst denies: **/.env*, **/secrets/**
        const result = await harness.execute({
          readPath: "/home/user/.env",
          expectAllowed: false,
        });

        expect(result.success).toBe(false);
      });

      test("allows writing to allowed paths", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // data-analyst allows write: /tmp/**, ./output/**
        const result = await harness.execute({
          writePath: "/tmp/output.txt",
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
      });

      test("blocks writing to disallowed paths", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // data-analyst only allows write to /tmp and ./output
        const result = await harness.execute({
          writePath: "/etc/passwd",
          expectAllowed: false,
        });

        expect(result.success).toBe(false);
      });
    });

    describe("Network Restrictions", () => {
      const harnessNoNet = new IntegrationTestHarness({
        name: `${target}-nonet-test`,
        bandPath: getExampleBandPath("code-runner"), // No network allowed
        target,
        timeout,
      });

      const harnessWithNet = new IntegrationTestHarness({
        name: `${target}-net-test`,
        bandPath: getExampleBandPath("web-reader"), // Network allowed
        target,
        timeout,
      });

      beforeAll(async () => {
        available = await harnessNoNet.checkAvailability();
        if (available) {
          await harnessNoNet.init();
          await harnessWithNet.init();
        }
      });

      afterAll(async () => {
        if (available) {
          await harnessNoNet.cleanup();
          await harnessWithNet.cleanup();
        }
      });

      test("blocks network when not allowed", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // code-runner has no net permissions
        const result = await harnessNoNet.execute({
          fetchUrl: "http://httpbin.org/ip",
          expectAllowed: false,
        });

        expect(result.success).toBe(false);
      });

      test("allows network when allowed", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // web-reader allows net: *
        const result = await harnessWithNet.execute({
          fetchUrl: "http://httpbin.org/ip",
          expectAllowed: true,
        });

        expect(result.success).toBe(true);
      });
    });

    describe("Resource Limits", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-limits-test`,
        bandPath: getExampleBandPath("minimal"),
        target,
        timeout,
      });

      beforeAll(async () => {
        available = await harness.checkAvailability();
        if (available) await harness.init();
      });

      afterAll(async () => {
        if (available) await harness.cleanup();
      });

      test("enforces timeout", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Request a 100ms timeout, then ask for a slow operation
        const result = await harness.execute({
          sleepMs: 5000, // Try to sleep 5 seconds
        }, 100); // But timeout after 100ms

        // Should timeout
        expect(result.success).toBe(false);
        expect(result.error?.code).toMatch(/TIMEOUT/i);
      });

      test("tracks output size", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          generateOutput: 1000, // Generate 1KB of output
        });

        expect(result.success).toBe(true);
        expect(result.metrics.outputBytes).toBeGreaterThan(0);
      });
    });
  });
}

/**
 * Run the full test suite across all executors.
 */
export function runAllExecutorSuites() {
  // Local executor - always available, fast
  // NOTE: local-dangerously does NOT enforce permissions!
  runExecutorSuite("local-dangerously", {
    timeout: 30000,
    skipIfUnavailable: false,
  });

  // Lima - requires Lima VM (macOS)
  runExecutorSuite("local-lima", {
    timeout: 180000,
    skipIfUnavailable: true,
  });

  // Cloudflare - requires wrangler + API token
  runExecutorSuite("cloudflare", {
    timeout: 180000,
    skipIfUnavailable: true,
  });
}

/**
 * Run permission enforcement tests across all sandboxed executors.
 * Excludes local-dangerously since it has no enforcement.
 *
 * NOTE: Permission enforcement is not yet fully implemented in the executors.
 * These tests are disabled until the band-shell integration is complete.
 */
export function runAllPermissionSuites() {
  // TODO: Enable when permission enforcement is implemented
  // Currently executors just echo input - they don't actually enforce permissions

  // // Lima - has VM isolation + band-shell
  // runPermissionSuite("local-lima", {
  //   timeout: 180000,
  //   skipIfUnavailable: true,
  // });

  // // Cloudflare - has V8 isolate + restricted fetch
  // runPermissionSuite("cloudflare", {
  //   timeout: 180000,
  //   skipIfUnavailable: true,
  // });
}
