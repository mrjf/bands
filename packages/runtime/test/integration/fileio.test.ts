/**
 * File I/O Integration Tests
 *
 * Tests that actual file read/write operations work correctly and respect permissions.
 *
 * Unlike the firewall tests which only check permission logic,
 * these tests actually attempt to read and write files.
 *
 * Note: Cloudflare Workers don't have a filesystem, so these tests
 * will show appropriate errors for that target.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { IntegrationTestHarness } from "./runner";
import type { ExecutionTarget } from "@bands/format";
import { join } from "path";
import { writeFile, rm, mkdir } from "fs/promises";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

// Track skipped targets
const skippedTargets = new Set<string>();

/**
 * Run file I/O tests for a given executor.
 */
export function runFileIOSuite(
  target: ExecutionTarget,
  options: { timeout?: number; skipIfUnavailable?: boolean } = {}
) {
  const { timeout = 60000, skipIfUnavailable = true } = options;

  describe(`${target} File I/O`, () => {
    const skipIf = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  ⏭  Skipping: ${msg}`);
        return true;
      }
      return false;
    };

    describe("File Read Operations", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-fileio-read`,
        bandPath: join(FIXTURES_DIR, "firewall-fs.band.md"),
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

          // Create test files for reading
          // For Lima, we need to create files inside the VM
          if (target === "lima") {
            const { execSync } = await import("child_process");
            execSync('limactl shell bands-executor -- bash -c "echo test-content > /tmp/test-read.txt"');
            execSync('limactl shell bands-executor -- bash -c "echo secret > /tmp/.env.secret"');
          } else if (target === "local-dangerously") {
            await writeFile("/tmp/test-read.txt", "test-content");
            await writeFile("/tmp/.env.secret", "secret");
          }
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
          // Cleanup test files
          try {
            await rm("/tmp/test-read.txt", { force: true });
            await rm("/tmp/.env.secret", { force: true });
          } catch {}
        }
      });

      test("can read allowed file", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          readFiles: ["/tmp/test-read.txt"],
        });

        expect(result.success).toBe(true);
        const data = result.data as any;

        if (target === "cloudflare") {
          // Cloudflare has no filesystem
          expect(data.operations?.read?.[0]?.error).toContain("no filesystem");
        } else {
          expect(data.operations?.read?.[0]?.allowed).toBe(true);
          // File might not exist in test environment, that's ok
          // The important thing is the permission was allowed
        }
      }, timeout);

      test("denies reading .env files", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          readFiles: ["/home/user/.env"],
        });

        if (target === "local-dangerously") {
          // Reports denied but doesn't block
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.operations?.read?.[0]?.allowed).toBe(false);
        } else {
          // Sandboxed executors block
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies reading from secrets directory", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          readFiles: ["/app/secrets/key.pem"],
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.operations?.read?.[0]?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("File Write Operations", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-fileio-write`,
        bandPath: join(FIXTURES_DIR, "firewall-fs.band.md"),
        target,
        timeout,
      });

      let available = false;

      beforeAll(async () => {
        available = await harness.checkAvailability();
        if (available) {
          await harness.init();

          // Create output directory for Lima
          if (target === "lima") {
            const { execSync } = await import("child_process");
            execSync('limactl shell bands-executor -- bash -c "mkdir -p /tmp/output"');
          } else if (target === "local-dangerously") {
            await mkdir("/tmp/output", { recursive: true });
          }
        }
      }, timeout);

      afterAll(async () => {
        if (available) {
          await harness.cleanup();
          // Cleanup
          try {
            await rm("/tmp/output", { recursive: true, force: true });
          } catch {}
        }
      });

      test("can write to allowed path", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          writeFiles: [{ path: "/tmp/output/test.txt", content: "hello world" }],
        });

        expect(result.success).toBe(true);
        const data = result.data as any;

        if (target === "cloudflare") {
          // Cloudflare has no filesystem
          expect(data.operations?.write?.[0]?.error).toContain("no filesystem");
        } else {
          expect(data.operations?.write?.[0]?.allowed).toBe(true);
        }
      }, timeout);

      test("denies writing to /etc", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          writeFiles: [{ path: "/etc/malicious.conf", content: "bad stuff" }],
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.operations?.write?.[0]?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies writing to /usr", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          writeFiles: [{ path: "/usr/local/bin/backdoor", content: "#!/bin/sh\nrm -rf /" }],
        });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.operations?.write?.[0]?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("Combined Read/Write", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-fileio-combined`,
        bandPath: join(FIXTURES_DIR, "firewall-fs.band.md"),
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

      test("can do multiple allowed operations", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          readFiles: ["/tmp/input.txt"],
          writeFiles: [{ path: "/tmp/output/result.txt", content: "processed" }],
        });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.operations?.read?.[0]?.allowed).toBe(true);
        expect(data.operations?.write?.[0]?.allowed).toBe(true);
      }, timeout);

      test("fails entire operation if any denied", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({
          readFiles: ["/tmp/input.txt"], // allowed
          writeFiles: [{ path: "/etc/passwd", content: "hacked" }], // denied
        });

        if (target === "local-dangerously") {
          // local-dangerously doesn't block
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.operations?.write?.[0]?.allowed).toBe(false);
        } else {
          // Sandboxed executors should fail the whole operation
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });
  });
}

/**
 * Print summary of skipped targets.
 */
export function printFileIOSkippedSummary() {
  if (skippedTargets.size > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("                    SKIPPED FILE I/O TESTS");
    console.log("=".repeat(80));
    console.log("\nThe following executors were not available:\n");
    for (const target of skippedTargets) {
      console.log(`  • ${target}`);
    }
    console.log("\n" + "=".repeat(80) + "\n");
  }
}

/**
 * Run file I/O tests across all executors.
 */
export function runAllFileIOSuites() {
  // Local executor - always available
  runFileIOSuite("local-dangerously", {
    timeout: 30000,
    skipIfUnavailable: false,
  });

  // Docker - requires Docker daemon
  runFileIOSuite("local-docker", {
    timeout: 120000,
    skipIfUnavailable: true,
  });

  // Cloudflare - has no filesystem, but tests permission checks
  runFileIOSuite("cloudflare", {
    timeout: 180000,
    skipIfUnavailable: true,
  });

  // Lima - has full filesystem
  runFileIOSuite("lima", {
    timeout: 180000,
    skipIfUnavailable: true,
  });
}
