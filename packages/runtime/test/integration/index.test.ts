/**
 * Integration Test Suite
 *
 * Runs the same tests across all execution targets to verify consistent behavior.
 *
 * Tests ERROR if the required target is not available:
 * - lima: Requires Lima VM running
 * - cloudflare: Requires wrangler + CLOUDFLARE_API_TOKEN
 *
 * Run with: bun test test/integration/
 */

import { runAllExecutorSuites, runAllPermissionSuites } from "./executor-suite";
import { runAllFirewallSuites } from "./firewall.test";
import { runAllInsistSuites } from "./insist.test";
import { runAllFileIOSuites } from "./fileio.test";

console.log(`
================================================================================
                        INTEGRATION TEST SUITE
================================================================================
Testing all execution targets with the same test cases.

Targets:
  • lima               - Lima VM isolation (macOS)
  • cloudflare         - Cloudflare Workers V8 isolates

Test Categories:
  • Basic Execution    - Simple request/response
  • Firewall           - Permission allow/deny enforcement
  • Insist             - Required operation enforcement
  • File I/O           - Actual file read/write operations

Tests will ERROR if a target is not available.
================================================================================
`);

// Run basic execution tests across all executors
runAllExecutorSuites();

// Run permission enforcement tests
runAllPermissionSuites();

// Run firewall enforcement tests across all executors
runAllFirewallSuites();

// Run insist enforcement tests across all executors
runAllInsistSuites();

// Run actual file I/O tests across all executors
runAllFileIOSuites();
