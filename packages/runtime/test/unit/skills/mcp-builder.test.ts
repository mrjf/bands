/**
 * Integration tests for the MCP Builder skill band.
 *
 * Tests MCP server creation, tool definition, resource handling, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("MCP Builder Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("mcp-builder"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("mcp-builder");
    });
  });

  describe("Server Creation", () => {
    it("should accept a request to create a basic MCP server", async () => {
      const response = await harness.request({
        task: "create_server",
        name: "my-mcp-server",
        description: "A sample MCP server",
        outputDir: "/path/to/output",
      });
      assertSuccess(response);
    });

    it("should accept a request to create server with TypeScript", async () => {
      const response = await harness.request({
        task: "create_server",
        name: "typescript-mcp",
        description: "TypeScript MCP server",
        language: "typescript",
        outputDir: "/path/to/output",
      });
      assertSuccess(response);
    });

    it("should accept a request to create server with Python", async () => {
      const response = await harness.request({
        task: "create_server",
        name: "python-mcp",
        description: "Python MCP server",
        language: "python",
        outputDir: "/path/to/output",
      });
      assertSuccess(response);
    });
  });

  describe("Tool Definition", () => {
    it("should accept a request to add a tool", async () => {
      const response = await harness.request({
        task: "add_tool",
        serverDir: "/path/to/mcp-server",
        tool: {
          name: "get_weather",
          description: "Get current weather for a location",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" },
              units: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to add a tool with implementation", async () => {
      const response = await harness.request({
        task: "add_tool",
        serverDir: "/path/to/mcp-server",
        tool: {
          name: "calculate",
          description: "Perform a calculation",
          inputSchema: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
            required: ["expression"],
          },
          implementation: `
            const result = eval(input.expression);
            return { result };
          `,
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to list tools", async () => {
      const response = await harness.request({
        task: "list_tools",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });

    it("should accept a request to remove a tool", async () => {
      const response = await harness.request({
        task: "remove_tool",
        serverDir: "/path/to/mcp-server",
        toolName: "old_tool",
      });
      assertSuccess(response);
    });
  });

  describe("Resource Definition", () => {
    it("should accept a request to add a resource", async () => {
      const response = await harness.request({
        task: "add_resource",
        serverDir: "/path/to/mcp-server",
        resource: {
          uri: "file:///config",
          name: "Configuration",
          description: "Application configuration",
          mimeType: "application/json",
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to add a resource template", async () => {
      const response = await harness.request({
        task: "add_resource_template",
        serverDir: "/path/to/mcp-server",
        template: {
          uriTemplate: "file:///users/{userId}",
          name: "User Profile",
          description: "Get user profile by ID",
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to list resources", async () => {
      const response = await harness.request({
        task: "list_resources",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });
  });

  describe("Prompt Definition", () => {
    it("should accept a request to add a prompt", async () => {
      const response = await harness.request({
        task: "add_prompt",
        serverDir: "/path/to/mcp-server",
        prompt: {
          name: "summarize",
          description: "Summarize a document",
          arguments: [
            { name: "content", description: "The content to summarize", required: true },
            { name: "length", description: "Target length", required: false },
          ],
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to list prompts", async () => {
      const response = await harness.request({
        task: "list_prompts",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });
  });

  describe("Server Configuration", () => {
    it("should accept a request to update server config", async () => {
      const response = await harness.request({
        task: "update_config",
        serverDir: "/path/to/mcp-server",
        config: {
          name: "updated-mcp-server",
          version: "1.1.0",
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
          },
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to read server config", async () => {
      const response = await harness.request({
        task: "read_config",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });
  });

  describe("Testing", () => {
    it("should accept a request to test a tool", async () => {
      const response = await harness.request({
        task: "test_tool",
        serverDir: "/path/to/mcp-server",
        toolName: "get_weather",
        input: { location: "San Francisco" },
      });
      assertSuccess(response);
    });

    it("should accept a request to run all tests", async () => {
      const response = await harness.request({
        task: "run_tests",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });
  });

  describe("Deployment", () => {
    it("should accept a request to build the server", async () => {
      const response = await harness.request({
        task: "build",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate package.json", async () => {
      const response = await harness.request({
        task: "generate_package_json",
        serverDir: "/path/to/mcp-server",
        dependencies: {
          axios: "^1.6.0",
          zod: "^3.22.0",
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to install dependencies", async () => {
      const response = await harness.request({
        task: "install_dependencies",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });
  });

  describe("Documentation", () => {
    it("should accept a request to generate README", async () => {
      const response = await harness.request({
        task: "generate_readme",
        serverDir: "/path/to/mcp-server",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate API documentation", async () => {
      const response = await harness.request({
        task: "generate_docs",
        serverDir: "/path/to/mcp-server",
        format: "markdown",
      });
      assertSuccess(response);
    });
  });
});
