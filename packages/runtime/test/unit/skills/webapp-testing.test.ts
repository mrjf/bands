/**
 * Integration tests for the Webapp Testing skill band.
 *
 * Tests Playwright-based web automation: navigation, screenshots,
 * element interaction, form filling, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("Webapp Testing Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("webapp-testing"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("webapp-testing");
    });
  });

  describe("Navigation", () => {
    it("should accept a request to navigate to a URL", async () => {
      const response = await harness.request({
        task: "navigate",
        url: "http://localhost:3000",
      });
      assertSuccess(response);
    });

    it("should accept a request to navigate and wait for load", async () => {
      const response = await harness.request({
        task: "navigate",
        url: "http://localhost:3000/dashboard",
        waitUntil: "networkidle",
      });
      assertSuccess(response);
    });

    it("should accept a request to go back", async () => {
      const response = await harness.request({
        task: "go_back",
      });
      assertSuccess(response);
    });

    it("should accept a request to refresh the page", async () => {
      const response = await harness.request({
        task: "refresh",
      });
      assertSuccess(response);
    });
  });

  describe("Screenshots", () => {
    it("should accept a request to take a full page screenshot", async () => {
      const response = await harness.request({
        task: "screenshot",
        url: "http://localhost:3000",
        output: "/tmp/screenshot.png",
        fullPage: true,
      });
      assertSuccess(response);
    });

    it("should accept a request to screenshot a specific element", async () => {
      const response = await harness.request({
        task: "screenshot",
        url: "http://localhost:3000",
        selector: "#main-content",
        output: "/tmp/element.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to screenshot with specific viewport", async () => {
      const response = await harness.request({
        task: "screenshot",
        url: "http://localhost:3000",
        viewport: { width: 1920, height: 1080 },
        output: "/tmp/desktop.png",
      });
      assertSuccess(response);
    });

    it("should accept mobile viewport screenshot request", async () => {
      const response = await harness.request({
        task: "screenshot",
        url: "http://localhost:3000",
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        output: "/tmp/mobile.png",
      });
      assertSuccess(response);
    });
  });

  describe("Element Discovery", () => {
    it("should accept a request to find elements by selector", async () => {
      const response = await harness.request({
        task: "find_elements",
        url: "http://localhost:3000",
        selector: "button",
      });
      assertSuccess(response);
    });

    it("should accept a request to find elements by text", async () => {
      const response = await harness.request({
        task: "find_elements",
        url: "http://localhost:3000",
        text: "Submit",
      });
      assertSuccess(response);
    });

    it("should accept a request to get page content", async () => {
      const response = await harness.request({
        task: "get_content",
        url: "http://localhost:3000",
      });
      assertSuccess(response);
    });

    it("should accept a request to get element attributes", async () => {
      const response = await harness.request({
        task: "get_attributes",
        url: "http://localhost:3000",
        selector: "#login-form",
      });
      assertSuccess(response);
    });
  });

  describe("Element Interaction", () => {
    it("should accept a request to click an element", async () => {
      const response = await harness.request({
        task: "click",
        url: "http://localhost:3000",
        selector: "button#submit",
      });
      assertSuccess(response);
    });

    it("should accept a request to click by text", async () => {
      const response = await harness.request({
        task: "click",
        url: "http://localhost:3000",
        text: "Sign In",
      });
      assertSuccess(response);
    });

    it("should accept a request to type into an input", async () => {
      const response = await harness.request({
        task: "type",
        url: "http://localhost:3000",
        selector: "input#email",
        text: "user@example.com",
      });
      assertSuccess(response);
    });

    it("should accept a request to select from dropdown", async () => {
      const response = await harness.request({
        task: "select",
        url: "http://localhost:3000",
        selector: "select#country",
        value: "US",
      });
      assertSuccess(response);
    });

    it("should accept a request to check a checkbox", async () => {
      const response = await harness.request({
        task: "check",
        url: "http://localhost:3000",
        selector: "input#agree",
      });
      assertSuccess(response);
    });

    it("should accept a request to hover over element", async () => {
      const response = await harness.request({
        task: "hover",
        url: "http://localhost:3000",
        selector: ".dropdown-trigger",
      });
      assertSuccess(response);
    });
  });

  describe("Form Filling", () => {
    it("should accept a request to fill a form", async () => {
      const response = await harness.request({
        task: "fill_form",
        url: "http://localhost:3000/login",
        fields: {
          "#email": "user@example.com",
          "#password": "password123",
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to fill and submit form", async () => {
      const response = await harness.request({
        task: "fill_form",
        url: "http://localhost:3000/register",
        fields: {
          "#name": "John Doe",
          "#email": "john@example.com",
          "#password": "securepass",
        },
        submit: true,
        submitSelector: "button[type=submit]",
      });
      assertSuccess(response);
    });
  });

  describe("Waiting", () => {
    it("should accept a request to wait for selector", async () => {
      const response = await harness.request({
        task: "wait_for",
        url: "http://localhost:3000",
        selector: ".loading-complete",
        timeout: 5000,
      });
      assertSuccess(response);
    });

    it("should accept a request to wait for text", async () => {
      const response = await harness.request({
        task: "wait_for",
        url: "http://localhost:3000",
        text: "Data loaded",
        timeout: 5000,
      });
      assertSuccess(response);
    });

    it("should accept a request to wait for navigation", async () => {
      const response = await harness.request({
        task: "wait_for_navigation",
        timeout: 10000,
      });
      assertSuccess(response);
    });
  });

  describe("Console and Network", () => {
    it("should accept a request to capture console logs", async () => {
      const response = await harness.request({
        task: "capture_console",
        url: "http://localhost:3000",
        duration: 3000,
      });
      assertSuccess(response);
    });

    it("should accept a request to capture network requests", async () => {
      const response = await harness.request({
        task: "capture_network",
        url: "http://localhost:3000",
        duration: 3000,
      });
      assertSuccess(response);
    });

    it("should accept a request to check for errors", async () => {
      const response = await harness.request({
        task: "check_errors",
        url: "http://localhost:3000",
      });
      assertSuccess(response);
    });
  });

  describe("Server Management", () => {
    it("should accept a request to start a dev server", async () => {
      const response = await harness.request({
        task: "start_server",
        command: "npm run dev",
        port: 5173,
        workdir: "/path/to/project",
      });
      assertSuccess(response);
    });

    it("should accept a request to start multiple servers", async () => {
      const response = await harness.request({
        task: "start_servers",
        servers: [
          { command: "cd backend && python server.py", port: 3000 },
          { command: "cd frontend && npm run dev", port: 5173 },
        ],
      });
      assertSuccess(response);
    });
  });

  describe("Testing Workflows", () => {
    it("should accept a login test scenario", async () => {
      const response = await harness.request({
        task: "test_scenario",
        name: "login_flow",
        steps: [
          { action: "navigate", url: "http://localhost:3000/login" },
          { action: "type", selector: "#email", text: "user@test.com" },
          { action: "type", selector: "#password", text: "password" },
          { action: "click", selector: "button[type=submit]" },
          { action: "wait_for", selector: ".dashboard" },
          { action: "screenshot", output: "/tmp/dashboard.png" },
        ],
      });
      assertSuccess(response);
    });

    it("should accept a visual regression test request", async () => {
      const response = await harness.request({
        task: "visual_regression",
        url: "http://localhost:3000",
        baseline: "/path/to/baseline.png",
        output: "/tmp/diff.png",
        threshold: 0.1,
      });
      assertSuccess(response);
    });
  });

  describe("Accessibility", () => {
    it("should accept an accessibility audit request", async () => {
      const response = await harness.request({
        task: "accessibility_audit",
        url: "http://localhost:3000",
      });
      assertSuccess(response);
    });
  });

  describe("PDF Generation", () => {
    it("should accept a request to generate PDF from page", async () => {
      const response = await harness.request({
        task: "generate_pdf",
        url: "http://localhost:3000/report",
        output: "/tmp/report.pdf",
        options: {
          format: "A4",
          printBackground: true,
        },
      });
      assertSuccess(response);
    });
  });
});
