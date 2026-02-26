/**
 * Unit Test Suite Entry Point
 *
 * These tests validate band parsing, request handling, and security rules
 * using an in-memory mock server. They do NOT deploy to real execution targets.
 *
 * For real integration tests that deploy to Cloudflare/Docker, see test/integration/
 *
 * Run with: bun test test/unit/
 */

// Skill unit tests (mock server, validates request/response shapes)
import "./skills/pdf.test";
import "./skills/docx.test";
import "./skills/xlsx.test";
import "./skills/pptx.test";
import "./skills/mcp-builder.test";
import "./skills/webapp-testing.test";
import "./skills/frontend-design.test";
import "./skills/skill-creator.test";
import "./skills/algorithmic-art.test";
import "./skills/brand-guidelines.test";

// Security rule validation tests (mock server)
import "./security/jailbreak.test";

console.log("Running unit tests for wrapped skills (mock server)...");
