/**
 * Integration Test Suite
 *
 * Runs the same tests across all execution targets to verify consistent behavior.
 *
 * Tests SKIP if the required target is not available:
 * - local-dangerously: Always available (no isolation)
 * - local-docker: Requires Docker daemon running
 * - cloudflare: Requires wrangler + CLOUDFLARE_API_TOKEN
 * - lima: Requires Lima VM (macOS)
 *
 * Run with: bun test test/integration/
 */

import { afterAll } from "bun:test";
import { runAllExecutorSuites, runAllPermissionSuites, printSkippedSummary } from "./executor-suite";
import { runAllFirewallSuites, printFirewallSkippedSummary } from "./firewall.test";
import { runAllInsistSuites, printInsistSkippedSummary } from "./insist.test";
import { runAllFileIOSuites, printFileIOSkippedSummary } from "./fileio.test";

console.log(`
================================================================================
                        INTEGRATION TEST SUITE
================================================================================
Testing all execution targets with the same test cases.

Targets:
  • local-dangerously  - No isolation (always available)
  • local-docker       - Docker container isolation
  • cloudflare         - Cloudflare Workers V8 isolates
  • lima               - Lima VM isolation (macOS)

Test Categories:
  • Basic Execution    - Simple request/response
  • Firewall           - Permission allow/deny enforcement
  • Insist             - Required operation enforcement
  • File I/O           - Actual file read/write operations

Tests will SKIP if a target is not available.
================================================================================
`);

// Run basic execution tests across all executors
runAllExecutorSuites();

// Run permission enforcement tests (excludes local-dangerously)
runAllPermissionSuites();

// Run firewall enforcement tests across all executors
runAllFirewallSuites();

// Run insist enforcement tests across all executors
runAllInsistSuites();

// Run actual file I/O tests across all executors
runAllFileIOSuites();

// Print summary of skipped tests at the end
afterAll(() => {
  printSkippedSummary();
  printFirewallSkippedSummary();
  printInsistSkippedSummary();
  printFileIOSkippedSummary();
});
