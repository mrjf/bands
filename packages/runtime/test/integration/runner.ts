/**
 * Real Integration Test Runner
 *
 * This runner deploys bands to actual execution targets (Cloudflare Workers, Docker)
 * and runs tests against them. These are true integration tests.
 *
 * NOTE: These tests require:
 * - For Cloudflare: wrangler installed + CLOUDFLARE_API_TOKEN in root .env
 * - For Docker: Docker daemon running
 *
 * Tests FAIL if the required target is not available.
 */

// Load .env from monorepo root
import { join, dirname } from "path";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";

function loadRootEnv() {
  // Try multiple possible locations for the root .env
  const possibleRoots = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "..", ".env"),
    join(process.cwd(), "..", "..", ".env"),
    join(process.cwd(), "..", "..", "..", ".env"),
  ];

  for (const rootEnvPath of possibleRoots) {
    if (existsSync(rootEnvPath)) {
      const content = readFileSync(rootEnvPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex);
            const value = trimmed.slice(eqIndex + 1);
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
      break;
    }
  }
}

loadRootEnv();

import { parseBandMd, type BandDocument, type ExecutionTarget } from "@bands/format";
import {
  executeBand,
  isTargetAvailable,
  getExecutor,
  type ExecutorResult,
} from "../../src/executors";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface IntegrationTestConfig {
  /** Name of the test suite */
  name: string;
  /** Path to the band.md file */
  bandPath: string;
  /** Which target to test (will skip if not available) */
  target: ExecutionTarget;
  /** Timeout for each test in ms */
  timeout?: number;
}

export interface IntegrationTestCase {
  /** Test name */
  name: string;
  /** Input payload to send */
  input: unknown;
  /** Validate the result */
  validate: (result: ExecutorResult) => void | Promise<void>;
  /** Optional timeout override for this specific test */
  timeout?: number;
}

/**
 * Integration test harness that deploys to real execution targets.
 */
export class IntegrationTestHarness {
  private band: BandDocument | null = null;
  private target: ExecutionTarget;
  private timeout: number;
  private available: boolean = false;

  constructor(private config: IntegrationTestConfig) {
    this.target = config.target;
    this.timeout = config.timeout ?? 60000; // Default 60s for real deployments
  }

  /**
   * Check if the target is available. Call this in beforeAll.
   * Returns false if the target is not available (tests should be skipped).
   */
  async checkAvailability(): Promise<boolean> {
    this.available = await isTargetAvailable(this.target);
    return this.available;
  }

  /**
   * Initialize by parsing the band file.
   */
  async init(): Promise<void> {
    if (!existsSync(this.config.bandPath)) {
      throw new Error(`Band file not found: ${this.config.bandPath}`);
    }

    const content = readFileSync(this.config.bandPath, "utf-8");
    const { document, errors } = parseBandMd(content);

    // We allow validation warnings (like human-readable limits "5m")
    // as long as we have a valid document structure
    if (!document || !document.band) {
      throw new Error(`Failed to parse band: ${errors.map((e) => e.message).join(", ")}`);
    }

    this.band = document;
  }

  /**
   * Execute the band with the given input on the configured target.
   */
  async execute(input: unknown, timeout?: number): Promise<ExecutorResult> {
    if (!this.band) {
      throw new Error("Harness not initialized. Call init() first.");
    }

    if (!this.available) {
      throw new Error(`Target ${this.target} is not available`);
    }

    return executeBand(this.band, input, {
      target: this.target,
      timeoutMs: timeout ?? this.timeout,
    });
  }

  /**
   * Get the parsed band document.
   */
  getBand(): BandDocument | null {
    return this.band;
  }

  /**
   * Check if tests should run (target is available).
   */
  shouldRun(): boolean {
    return this.available;
  }

  /**
   * Clean up any deployed resources.
   */
  async cleanup(): Promise<void> {
    if (!this.available) return;

    try {
      const executor = await getExecutor(this.target);
      if (executor.cleanup) {
        await executor.cleanup();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Helper to get the path to a wrapped skill band.
 */
export function getWrappedSkillPath(skillName: string): string {
  const paths = [
    join(process.cwd(), "wrapped-skills", `${skillName}.band.md`),
    join(process.cwd(), "..", "..", "wrapped-skills", `${skillName}.band.md`),
    join(process.cwd(), "packages", "runtime", "wrapped-skills", `${skillName}.band.md`),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  throw new Error(`Wrapped skill not found: ${skillName} (searched: ${paths.join(", ")})`);
}

/**
 * Helper to get path to example bands.
 * Searches in multiple locations:
 * - examples/ directory (for .band.md files)
 * - packages/bands/<name>/ directory (for BAND.md files)
 */
export function getExampleBandPath(name: string): string {
  const paths = [
    // Example bands
    join(process.cwd(), "examples", `${name}.band.md`),
    join(process.cwd(), "..", "..", "examples", `${name}.band.md`),
    // Package bands (BAND.md format)
    join(process.cwd(), "packages", "bands", name, "BAND.md"),
    join(process.cwd(), "..", "..", "packages", "bands", name, "BAND.md"),
    join(process.cwd(), "..", "bands", name, "BAND.md"),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  throw new Error(`Example band not found: ${name} (searched: ${paths.join(", ")})`);
}

/**
 * Assert that execution succeeded.
 */
export function assertSuccess(result: ExecutorResult): void {
  if (!result.success) {
    throw new Error(
      `Expected success but got error: ${result.error?.code} - ${result.error?.message}`
    );
  }
}

/**
 * Assert that execution failed with a specific error code.
 */
export function assertError(result: ExecutorResult, expectedCode?: string): void {
  if (result.success) {
    throw new Error(`Expected error but got success`);
  }
  if (expectedCode && result.error?.code !== expectedCode) {
    throw new Error(`Expected error code ${expectedCode} but got ${result.error?.code}`);
  }
}

/**
 * Assert that execution completed within a time limit.
 */
export function assertTiming(result: ExecutorResult, maxDurationMs: number): void {
  if (result.metrics.durationMs > maxDurationMs) {
    throw new Error(
      `Execution took ${result.metrics.durationMs}ms, expected < ${maxDurationMs}ms`
    );
  }
}

