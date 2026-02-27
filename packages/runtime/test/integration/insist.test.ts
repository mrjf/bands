/**
 * Insist Integration Tests
 *
 * Tests that `insist` enforcement works correctly across all execution targets.
 *
 * The `insist` field means "these operations MUST be performed during execution."
 * If an execution completes without performing all insist operations, it fails.
 *
 * Key behavior:
 * - local-dangerously: Reports insist satisfaction but doesn't fail (enforced: false)
 * - cloudflare, lima: FAIL if insist items not satisfied (enforced: true)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { IntegrationTestHarness } from "./runner";
import type { ExecutionTarget } from "@bands/format";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

// Track skipped targets
const skippedTargets = new Set<string>();

/**
 * Run insist tests for a given executor.
 */
export function runInsistSuite(
  target: ExecutionTarget,
  options: { timeout?: number; skipIfUnavailable?: boolean } = {}
) {
  const { timeout = 60000, skipIfUnavailable = true } = options;

  describe(`${target} Insist Enforcement`, () => {
    const skipIf = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  ⏭  Skipping: ${msg}`);
        return true;
      }
      return false;
    };

    describe("CLI Insist", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-insist-cli`,
        bandPath: join(FIXTURES_DIR, "insist-cli.band.md"),
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
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("succeeds when insist CLI command is executed", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on "echo *", so we run an echo command
        const result = await harness.execute({
          runCli: ["echo hello world"],
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.insist?.satisfied).toBe(true);
      }, timeout);

      test("fails when insist CLI command is NOT executed", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on "echo *", but we only run ls
        const result = await harness.execute({
          runCli: ["ls /tmp"],
        });

        if (target === "local-dangerously") {
          // local-dangerously doesn't enforce insist
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.insist?.satisfied).toBe(false);
          expect(data.insist?.enforced).toBe(false);
        } else {
          // Sandboxed executors enforce insist
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("INSIST_NOT_SATISFIED");
        }
      }, timeout);

      test("fails when no CLI commands executed but insist requires one", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on "echo *", but we don't run any CLI
        const result = await harness.execute({
          readFiles: ["/tmp/nonexistent.txt"],
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.insist?.satisfied).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("INSIST_NOT_SATISFIED");
        }
      }, timeout);
    });

    describe("Read Insist", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-insist-read`,
        bandPath: join(FIXTURES_DIR, "insist-read.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("succeeds when insist file is read", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on reading /tmp/required.txt
        const result = await harness.execute({
          readFiles: ["/tmp/required.txt"],
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.insist?.satisfied).toBe(true);
      }, timeout);

      test("fails when insist file is NOT read", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on /tmp/required.txt but we read something else
        const result = await harness.execute({
          readFiles: ["/tmp/other.txt"],
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.insist?.satisfied).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("INSIST_NOT_SATISFIED");
        }
      }, timeout);
    });

    describe("Network Insist", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-insist-net`,
        bandPath: join(FIXTURES_DIR, "insist-net.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        available = await harness.checkAvailability();
        if (available) {
          await harness.init();
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
        }
      });

      test("succeeds when insist host is accessed", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on httpbin.org
        const result = await harness.execute({
          fetchUrls: ["https://httpbin.org/get"],
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.insist?.satisfied).toBe(true);
      }, timeout);

      test("fails when insist host is NOT accessed", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        // Band insists on httpbin.org but we only access github
        const result = await harness.execute({
          fetchUrls: ["https://api.github.com"],
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.insist?.satisfied).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("INSIST_NOT_SATISFIED");
        }
      }, timeout);
    });
  });
}

/**
 * Print summary of skipped targets.
 */
export function printInsistSkippedSummary() {
  if (skippedTargets.size > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("                    SKIPPED INSIST TESTS");
    console.log("=".repeat(80));
    console.log("\nThe following executors were not available:\n");
    for (const target of skippedTargets) {
      console.log(`  • ${target}`);
    }
    console.log("\n" + "=".repeat(80) + "\n");
  }
}

/**
 * Run insist tests across all executors.
 */
export function runAllInsistSuites() {
  // Local executor - always available, reports but doesn't enforce
  runInsistSuite("local-dangerously", {
    timeout: 30000,
    skipIfUnavailable: false,
  });

  // Lima - requires Lima VM, enforces insist
  runInsistSuite("lima", {
    timeout: 180000,
    skipIfUnavailable: true,
  });

  // Cloudflare - requires wrangler + API token, enforces insist
  runInsistSuite("cloudflare", {
    timeout: 180000,
    skipIfUnavailable: true,
  });
}
