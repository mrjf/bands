/**
 * Integration test runner for Band skills.
 *
 * Spins up a local instance of the band server, initializes it with a band config,
 * and runs test scenarios against it.
 */

import { createBandServer, type RuntimeState } from "../../src/server";
import { parseBandMd } from "@bands/format";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface TestScenario {
  name: string;
  description: string;
  input: unknown;
  expectedMode?: "sync" | "stream" | "async";
  validate: (response: TestResponse) => void | Promise<void>;
}

export interface TestResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  error?: { code: string; message: string };
}

export interface SecurityTestCase {
  name: string;
  description: string;
  input: unknown;
  /** What we're testing - egress, tools, filesystem, etc */
  category: "egress" | "tools" | "filesystem" | "limits" | "injection";
  /** The attack vector being tested */
  vector: string;
  /** Should this be blocked? */
  shouldBlock: boolean;
  validate: (response: TestResponse) => void | Promise<void>;
}

/**
 * Test harness that manages a band server instance for testing.
 */
export class BandTestHarness {
  private server: ReturnType<typeof createBandServer> | null = null;
  private port: number = 0;
  private bandName: string = "";

  /**
   * Initialize the test harness with a band configuration.
   */
  async init(bandPath: string): Promise<void> {
    const content = readFileSync(bandPath, "utf-8");
    const { document, errors } = parseBandMd(content);

    if (!document || errors.length > 0) {
      throw new Error(`Failed to parse band: ${errors.map((e) => e.message).join(", ")}`);
    }

    this.bandName = document.band;

    // Create a handler that simulates skill execution
    // In real tests, this would invoke the actual skill logic
    this.server = createBandServer(async (input, ctx) => {
      // Echo handler for basic testing
      // Real skill execution would happen here
      return {
        success: true,
        input,
        bandName: this.bandName,
        timestamp: Date.now(),
      };
    });

    // Initialize with the band config
    const initRequest = new Request("http://localhost/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
    });

    const initResponse = await this.server.app.fetch(initRequest);
    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(`Failed to initialize band: ${JSON.stringify(error)}`);
    }
  }

  /**
   * Send a request to the band server and return the response.
   */
  async request(input: unknown, mode?: "sync" | "stream" | "async"): Promise<TestResponse> {
    if (!this.server) {
      throw new Error("Harness not initialized. Call init() first.");
    }

    const url = mode ? `http://localhost/?mode=${mode}` : "http://localhost/";
    const request = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const response = await this.server.app.fetch(request);
    const body = await response.json();

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      body,
      headers,
      error: body?.error,
    };
  }

  /**
   * Check the health endpoint.
   */
  async health(): Promise<{ ready: boolean; band: string | null; error: string | null }> {
    if (!this.server) {
      throw new Error("Harness not initialized");
    }

    const request = new Request("http://localhost/health", { method: "GET" });
    const response = await this.server.app.fetch(request);
    return response.json();
  }

  /**
   * Get the current runtime state.
   */
  getState(): RuntimeState | null {
    return this.server?.state ?? null;
  }

  /**
   * Clean up resources.
   */
  async cleanup(): Promise<void> {
    this.server = null;
  }
}

/**
 * Run a set of test scenarios against a band.
 */
export async function runScenarios(
  bandPath: string,
  scenarios: TestScenario[]
): Promise<{ passed: number; failed: number; results: Array<{ name: string; passed: boolean; error?: string }> }> {
  const harness = new BandTestHarness();
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];
  let passed = 0;
  let failed = 0;

  try {
    await harness.init(bandPath);

    for (const scenario of scenarios) {
      try {
        const response = await harness.request(scenario.input, scenario.expectedMode);
        await scenario.validate(response);
        results.push({ name: scenario.name, passed: true });
        passed++;
      } catch (err) {
        results.push({
          name: scenario.name,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }
  } finally {
    await harness.cleanup();
  }

  return { passed, failed, results };
}

/**
 * Run security test cases against a band.
 */
export async function runSecurityTests(
  bandPath: string,
  testCases: SecurityTestCase[]
): Promise<{ passed: number; failed: number; results: Array<{ name: string; passed: boolean; error?: string; blocked: boolean }> }> {
  const harness = new BandTestHarness();
  const results: Array<{ name: string; passed: boolean; error?: string; blocked: boolean }> = [];
  let passed = 0;
  let failed = 0;

  try {
    await harness.init(bandPath);

    for (const testCase of testCases) {
      try {
        const response = await harness.request(testCase.input);
        const blocked = response.status >= 400 || response.error !== undefined;

        await testCase.validate(response);

        // Verify the blocking behavior matches expectations
        if (testCase.shouldBlock && !blocked) {
          throw new Error(`Expected request to be blocked but it succeeded`);
        }
        if (!testCase.shouldBlock && blocked) {
          throw new Error(`Expected request to succeed but it was blocked: ${response.error?.message}`);
        }

        results.push({ name: testCase.name, passed: true, blocked });
        passed++;
      } catch (err) {
        results.push({
          name: testCase.name,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
          blocked: false,
        });
        failed++;
      }
    }
  } finally {
    await harness.cleanup();
  }

  return { passed, failed, results };
}

/**
 * Load a band from the wrapped-skills directory.
 */
export function getWrappedSkillPath(skillName: string): string {
  const path = join(process.cwd(), "..", "..", "wrapped-skills", `${skillName}.band.md`);
  if (!existsSync(path)) {
    throw new Error(`Wrapped skill not found: ${path}`);
  }
  return path;
}

/**
 * Assert helper for tests.
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert equality helper.
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Assert that a value is defined.
 */
export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message ?? `Expected value to be defined`);
  }
}

/**
 * Assert that a response has an error with a specific code.
 */
export function assertError(response: TestResponse, expectedCode: string): void {
  assert(response.error !== undefined, `Expected error response but got success`);
  assertEqual(response.error!.code, expectedCode, `Expected error code ${expectedCode}`);
}

/**
 * Assert that a response succeeded (2xx status).
 */
export function assertSuccess(response: TestResponse): void {
  assert(
    response.status >= 200 && response.status < 300,
    `Expected success but got status ${response.status}: ${response.error?.message ?? "unknown error"}`
  );
}
