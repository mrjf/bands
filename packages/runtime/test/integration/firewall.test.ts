/**
 * Firewall Integration Tests
 *
 * Tests that permission enforcement works correctly across all execution targets.
 * Uses special test payloads that check permissions without executing actual operations.
 *
 * Key difference between executors:
 * - local-dangerously: Reports what WOULD be allowed, but doesn't enforce
 * - cloudflare, lima: Actually ENFORCE permissions (return errors on deny)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { IntegrationTestHarness } from "./runner";
import type { ExecutionTarget } from "@bands/format";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

// Track skipped targets
const skippedTargets = new Set<string>();

/**
 * Run firewall tests for a given executor.
 */
export function runFirewallSuite(
  target: ExecutionTarget,
  options: { timeout?: number; skipIfUnavailable?: boolean } = {}
) {
  const { timeout = 60000, skipIfUnavailable = true } = options;

  describe(`${target} Firewall Enforcement`, () => {
    // Helper to skip tests when executor unavailable
    const skipIf = (condition: boolean, msg: string) => {
      if (condition) {
        console.log(`  ⏭  Skipping: ${msg}`);
        return true;
      }
      return false;
    };

    describe("CLI Permission Enforcement", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-firewall-cli`,
        bandPath: join(FIXTURES_DIR, "firewall-cli.band.md"),
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

      test("allows commands matching allow patterns", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "echo hello world" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("allows cat command", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "cat /tmp/test.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("allows ls command", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "ls -la /tmp" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("denies rm command (in deny list)", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "rm -rf /tmp/test" });

        // For sandboxed executors, this should fail
        // For local-dangerously, it succeeds but reports denied
        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.cli?.allowed).toBe(false);
          expect(data.enforced).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies sudo command (in deny list)", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "sudo apt-get install foo" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.cli?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies curl command (not in allow list)", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "curl http://example.com" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.cli?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies wget command (not in allow list)", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "wget http://example.com" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.cli?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("Filesystem Permission Enforcement", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-firewall-fs`,
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

      test("allows reading from /tmp", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testRead: "/tmp/data.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.read?.allowed).toBe(true);
      }, timeout);

      test("allows reading from ./allowed directory", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testRead: "./allowed/file.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.read?.allowed).toBe(true);
      }, timeout);

      test("denies reading .env files", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testRead: "/home/user/.env" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.read?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies reading from secrets directory", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testRead: "/app/secrets/api-key.txt" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.read?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("allows writing to /tmp/output", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testWrite: "/tmp/output/result.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.write?.allowed).toBe(true);
      }, timeout);

      test("denies writing to /etc", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testWrite: "/etc/passwd" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.write?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies writing to /usr", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testWrite: "/usr/local/bin/malware" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.write?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("Network Permission Enforcement", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-firewall-net`,
        bandPath: join(FIXTURES_DIR, "firewall-net.band.md"),
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

      test("allows access to api.github.com", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testNet: "api.github.com" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.net?.allowed).toBe(true);
      }, timeout);

      test("allows access to httpbin.org", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testNet: "httpbin.org" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.net?.allowed).toBe(true);
      }, timeout);

      test("denies access to localhost", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testNet: "localhost" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.net?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies access to internal.corp domains", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testNet: "db.internal.corp" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.net?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("denies access to arbitrary domains not in allow list", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testNet: "evil.com" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.net?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);
    });

    describe("No Network Band Enforcement", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-firewall-nonet`,
        bandPath: join(FIXTURES_DIR, "firewall-no-net.band.md"),
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

      test("denies all network access when no net permissions", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testNet: "google.com" });

        if (target === "local-dangerously") {
          expect(result.success).toBe(true);
          const data = result.data as any;
          expect(data.permissions?.net?.allowed).toBe(false);
        } else {
          expect(result.success).toBe(false);
          expect(result.error?.code).toBe("PERMISSION_DENIED");
        }
      }, timeout);

      test("allows echo command (only allowed CLI)", async () => {
        if (skipIf(!available, `${target} not available`)) return;

        const result = await harness.execute({ testCli: "echo hello" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);
    });
  });
}

/**
 * Print summary of skipped targets.
 */
export function printFirewallSkippedSummary() {
  if (skippedTargets.size > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("                    SKIPPED FIREWALL TESTS");
    console.log("=".repeat(80));
    console.log("\nThe following executors were not available:\n");
    for (const target of skippedTargets) {
      let reason = "";
      switch (target) {
        case "lima":
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
 * Run firewall tests across all executors.
 */
export function runAllFirewallSuites() {
  // Local executor - always available, reports but doesn't enforce
  runFirewallSuite("local-dangerously", {
    timeout: 30000,
    skipIfUnavailable: false,
  });

  // Lima - requires Lima VM, enforces permissions
  runFirewallSuite("lima", {
    timeout: 180000,
    skipIfUnavailable: true,
  });

  // Cloudflare - requires wrangler + API token, enforces permissions
  runFirewallSuite("cloudflare", {
    timeout: 180000,
    skipIfUnavailable: true,
  });
}
