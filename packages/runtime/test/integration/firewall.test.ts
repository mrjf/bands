/**
 * Firewall Integration Tests
 *
 * Tests that permission enforcement works correctly across all execution targets.
 * Uses special test payloads that check permissions without executing actual operations.
 *
 * All executors (lima, cloudflare) actually ENFORCE permissions (return errors on deny).
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { IntegrationTestHarness } from "./runner";
import type { ExecutionTarget } from "@bands/format";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

/**
 * Run firewall tests for a given executor.
 */
export function runFirewallSuite(
  target: ExecutionTarget,
  options: { timeout?: number } = {}
) {
  const { timeout = 60000 } = options;

  describe(`${target} Firewall Enforcement`, () => {
    function requireTarget() {
      if (!available) throw new Error(`${target} executor is not available`);
    }

    let available = false;

    describe("CLI Permission Enforcement", () => {
      const harness = new IntegrationTestHarness({
        name: `${target}-firewall-cli`,
        bandPath: join(FIXTURES_DIR, "firewall-cli.band.md"),
        target,
        timeout,
      });

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

      test("allows commands matching allow patterns", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "echo hello world" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("allows cat command", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "cat /tmp/test.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("allows ls command", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "ls -la /tmp" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);

      test("denies rm command (in deny list)", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "rm -rf /tmp/test" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies sudo command (in deny list)", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "sudo apt-get install foo" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies curl command (not in allow list)", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "curl http://example.com" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies wget command (not in allow list)", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "wget http://example.com" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
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
        requireTarget();

        const result = await harness.execute({ testRead: "/tmp/data.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.read?.allowed).toBe(true);
      }, timeout);

      test("allows reading from ./allowed directory", async () => {
        requireTarget();

        const result = await harness.execute({ testRead: "./allowed/file.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.read?.allowed).toBe(true);
      }, timeout);

      test("denies reading .env files", async () => {
        requireTarget();

        const result = await harness.execute({ testRead: "/home/user/.env" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies reading from secrets directory", async () => {
        requireTarget();

        const result = await harness.execute({ testRead: "/app/secrets/api-key.txt" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("allows writing to /tmp/output", async () => {
        requireTarget();

        const result = await harness.execute({ testWrite: "/tmp/output/result.txt" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.write?.allowed).toBe(true);
      }, timeout);

      test("denies writing to /etc", async () => {
        requireTarget();

        const result = await harness.execute({ testWrite: "/etc/passwd" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies writing to /usr", async () => {
        requireTarget();

        const result = await harness.execute({ testWrite: "/usr/local/bin/malware" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
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
        requireTarget();

        const result = await harness.execute({ testNet: "api.github.com" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.net?.allowed).toBe(true);
      }, timeout);

      test("allows access to httpbin.org", async () => {
        requireTarget();

        const result = await harness.execute({ testNet: "httpbin.org" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.net?.allowed).toBe(true);
      }, timeout);

      test("denies access to localhost", async () => {
        requireTarget();

        const result = await harness.execute({ testNet: "localhost" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies access to internal.corp domains", async () => {
        requireTarget();

        const result = await harness.execute({ testNet: "db.internal.corp" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("denies access to arbitrary domains not in allow list", async () => {
        requireTarget();

        const result = await harness.execute({ testNet: "evil.com" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
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
        requireTarget();

        const result = await harness.execute({ testNet: "google.com" });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("PERMISSION_DENIED");
      }, timeout);

      test("allows echo command (only allowed CLI)", async () => {
        requireTarget();

        const result = await harness.execute({ testCli: "echo hello" });

        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data.permissions?.cli?.allowed).toBe(true);
      }, timeout);
    });
  });
}

/**
 * Run firewall tests across all executors.
 */
export function runAllFirewallSuites() {
  // Lima - requires Lima VM, enforces permissions
  runFirewallSuite("local-lima", {
    timeout: 180000,
  });

  // Cloudflare - requires wrangler + API token, enforces permissions
  runFirewallSuite("cloudflare", {
    timeout: 180000,
  });
}
