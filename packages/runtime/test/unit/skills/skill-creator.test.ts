/**
 * Integration tests for the Skill Creator skill band.
 *
 * Tests skill creation, validation, packaging, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("Skill Creator Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("skill-creator"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("skill-creator");
    });
  });

  describe("Skill Initialization", () => {
    it("should accept a request to create a new skill", async () => {
      const response = await harness.request({
        task: "init_skill",
        name: "my-skill",
        outputDir: "/path/to/skills/",
      });
      assertSuccess(response);
    });

    it("should accept a request to create skill with description", async () => {
      const response = await harness.request({
        task: "init_skill",
        name: "data-analyzer",
        description: "Analyze and visualize data from various sources",
        outputDir: "/path/to/skills/",
      });
      assertSuccess(response);
    });
  });

  describe("SKILL.md Editing", () => {
    it("should accept a request to read SKILL.md", async () => {
      const response = await harness.request({
        task: "read_skill",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });

    it("should accept a request to update frontmatter", async () => {
      const response = await harness.request({
        task: "update_frontmatter",
        skillDir: "/path/to/my-skill/",
        frontmatter: {
          name: "updated-skill",
          description: "Updated description",
          "allowed-tools": "Bash, Read, Write, Edit",
        },
      });
      assertSuccess(response);
    });

    it("should accept a request to update instructions", async () => {
      const response = await harness.request({
        task: "update_instructions",
        skillDir: "/path/to/my-skill/",
        instructions: `
# My Skill

## Overview
This skill helps with...

## Usage
To use this skill...

## Examples
\`\`\`python
# Example code
\`\`\`
        `.trim(),
      });
      assertSuccess(response);
    });

    it("should accept a request to add a section", async () => {
      const response = await harness.request({
        task: "add_section",
        skillDir: "/path/to/my-skill/",
        heading: "## Advanced Usage",
        content: "For advanced use cases, you can...",
        after: "## Usage",
      });
      assertSuccess(response);
    });
  });

  describe("Script Management", () => {
    it("should accept a request to add a Python script", async () => {
      const response = await harness.request({
        task: "add_script",
        skillDir: "/path/to/my-skill/",
        filename: "process_data.py",
        content: `
import sys
import json

def process(data):
    return {"processed": data}

if __name__ == "__main__":
    input_data = json.loads(sys.argv[1])
    result = process(input_data)
    print(json.dumps(result))
        `.trim(),
      });
      assertSuccess(response);
    });

    it("should accept a request to add a Bash script", async () => {
      const response = await harness.request({
        task: "add_script",
        skillDir: "/path/to/my-skill/",
        filename: "setup.sh",
        content: `
#!/bin/bash
set -e

echo "Setting up environment..."
pip install -r requirements.txt
echo "Done!"
        `.trim(),
      });
      assertSuccess(response);
    });

    it("should accept a request to list scripts", async () => {
      const response = await harness.request({
        task: "list_scripts",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });

    it("should accept a request to remove a script", async () => {
      const response = await harness.request({
        task: "remove_script",
        skillDir: "/path/to/my-skill/",
        filename: "old_script.py",
      });
      assertSuccess(response);
    });
  });

  describe("Reference Management", () => {
    it("should accept a request to add a reference file", async () => {
      const response = await harness.request({
        task: "add_reference",
        skillDir: "/path/to/my-skill/",
        filename: "api_docs.md",
        content: `
# API Documentation

## Endpoints

### GET /users
Returns a list of users.

### POST /users
Creates a new user.
        `.trim(),
      });
      assertSuccess(response);
    });

    it("should accept a request to list references", async () => {
      const response = await harness.request({
        task: "list_references",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });
  });

  describe("Asset Management", () => {
    it("should accept a request to add an asset", async () => {
      const response = await harness.request({
        task: "add_asset",
        skillDir: "/path/to/my-skill/",
        filename: "template.html",
        sourcePath: "/path/to/template.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to list assets", async () => {
      const response = await harness.request({
        task: "list_assets",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });
  });

  describe("Validation", () => {
    it("should accept a request to validate a skill", async () => {
      const response = await harness.request({
        task: "validate",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });

    it("should accept a request to validate frontmatter only", async () => {
      const response = await harness.request({
        task: "validate_frontmatter",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });

    it("should accept a request to check script syntax", async () => {
      const response = await harness.request({
        task: "check_scripts",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });
  });

  describe("Packaging", () => {
    it("should accept a request to package a skill", async () => {
      const response = await harness.request({
        task: "package",
        skillDir: "/path/to/my-skill/",
        outputDir: "/path/to/output/",
      });
      assertSuccess(response);
    });

    it("should accept a request to package with custom name", async () => {
      const response = await harness.request({
        task: "package",
        skillDir: "/path/to/my-skill/",
        outputDir: "/path/to/output/",
        outputName: "my-skill-v2",
      });
      assertSuccess(response);
    });
  });

  describe("Testing", () => {
    it("should accept a request to test a skill", async () => {
      const response = await harness.request({
        task: "test_skill",
        skillDir: "/path/to/my-skill/",
        input: { task: "analyze", data: [1, 2, 3] },
      });
      assertSuccess(response);
    });

    it("should accept a request to run skill scripts", async () => {
      const response = await harness.request({
        task: "run_script",
        skillDir: "/path/to/my-skill/",
        script: "process_data.py",
        args: { input: "test data" },
      });
      assertSuccess(response);
    });
  });

  describe("Analysis", () => {
    it("should accept a request to analyze skill usage patterns", async () => {
      const response = await harness.request({
        task: "analyze_skill",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });

    it("should accept a request to check skill completeness", async () => {
      const response = await harness.request({
        task: "check_completeness",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });

    it("should accept a request to estimate context usage", async () => {
      const response = await harness.request({
        task: "estimate_context",
        skillDir: "/path/to/my-skill/",
      });
      assertSuccess(response);
    });
  });

  describe("Import/Export", () => {
    it("should accept a request to import from URL", async () => {
      const response = await harness.request({
        task: "import_skill",
        source: "https://github.com/user/skills/tree/main/skills/my-skill",
        outputDir: "/path/to/skills/",
      });
      assertSuccess(response);
    });

    it("should accept a request to clone a skill", async () => {
      const response = await harness.request({
        task: "clone_skill",
        sourceDir: "/path/to/existing-skill/",
        newName: "cloned-skill",
        outputDir: "/path/to/skills/",
      });
      assertSuccess(response);
    });
  });
});
