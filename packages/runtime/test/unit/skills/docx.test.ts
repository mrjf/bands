/**
 * Integration tests for the DOCX skill band.
 *
 * Tests typical Word document operations: reading, writing, formatting,
 * tracked changes, comments, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("DOCX Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("docx"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("docx");
    });
  });

  describe("Document Reading", () => {
    it("should accept a request to read document text", async () => {
      const response = await harness.request({
        task: "read_text",
        file: "/path/to/document.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to read document with formatting", async () => {
      const response = await harness.request({
        task: "read_formatted",
        file: "/path/to/document.docx",
        includeStyles: true,
      });
      assertSuccess(response);
    });

    it("should accept a request to extract document structure", async () => {
      const response = await harness.request({
        task: "read_structure",
        file: "/path/to/document.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Document Creation", () => {
    it("should accept a request to create a simple document", async () => {
      const response = await harness.request({
        task: "create",
        content: "Hello, World!",
        output: "/path/to/new.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a document with structure", async () => {
      const response = await harness.request({
        task: "create",
        content: {
          title: "Document Title",
          sections: [
            { heading: "Introduction", body: "This is the intro." },
            { heading: "Main Content", body: "This is the main content." },
            { heading: "Conclusion", body: "This is the conclusion." },
          ],
        },
        output: "/path/to/structured.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create from template", async () => {
      const response = await harness.request({
        task: "create_from_template",
        template: "/path/to/template.docx",
        replacements: {
          "{{name}}": "John Doe",
          "{{date}}": "2024-01-15",
          "{{company}}": "Acme Corp",
        },
        output: "/path/to/from-template.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Document Editing", () => {
    it("should accept a request to replace text", async () => {
      const response = await harness.request({
        task: "replace_text",
        file: "/path/to/document.docx",
        find: "old text",
        replace: "new text",
        output: "/path/to/edited.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to append content", async () => {
      const response = await harness.request({
        task: "append",
        file: "/path/to/document.docx",
        content: "Additional content to append.",
        output: "/path/to/appended.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to insert at position", async () => {
      const response = await harness.request({
        task: "insert",
        file: "/path/to/document.docx",
        content: "Inserted paragraph",
        position: "after_heading",
        headingText: "Introduction",
        output: "/path/to/inserted.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Tracked Changes", () => {
    it("should accept a request to enable tracked changes", async () => {
      const response = await harness.request({
        task: "enable_track_changes",
        file: "/path/to/document.docx",
        author: "John Doe",
        output: "/path/to/tracked.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to list tracked changes", async () => {
      const response = await harness.request({
        task: "list_tracked_changes",
        file: "/path/to/tracked.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to accept all changes", async () => {
      const response = await harness.request({
        task: "accept_all_changes",
        file: "/path/to/tracked.docx",
        output: "/path/to/accepted.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to reject all changes", async () => {
      const response = await harness.request({
        task: "reject_all_changes",
        file: "/path/to/tracked.docx",
        output: "/path/to/rejected.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Comments", () => {
    it("should accept a request to add a comment", async () => {
      const response = await harness.request({
        task: "add_comment",
        file: "/path/to/document.docx",
        text: "This needs review",
        author: "Reviewer",
        targetText: "important section",
        output: "/path/to/commented.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to list comments", async () => {
      const response = await harness.request({
        task: "list_comments",
        file: "/path/to/document.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to remove all comments", async () => {
      const response = await harness.request({
        task: "remove_comments",
        file: "/path/to/document.docx",
        output: "/path/to/no-comments.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Formatting", () => {
    it("should accept a request to apply styles", async () => {
      const response = await harness.request({
        task: "apply_style",
        file: "/path/to/document.docx",
        targetText: "Chapter 1",
        style: "Heading1",
        output: "/path/to/styled.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to change font", async () => {
      const response = await harness.request({
        task: "change_font",
        file: "/path/to/document.docx",
        font: "Arial",
        size: 12,
        output: "/path/to/fonted.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Tables", () => {
    it("should accept a request to insert a table", async () => {
      const response = await harness.request({
        task: "insert_table",
        file: "/path/to/document.docx",
        data: [
          ["Name", "Age", "City"],
          ["Alice", "30", "NYC"],
          ["Bob", "25", "LA"],
        ],
        output: "/path/to/with-table.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to extract tables", async () => {
      const response = await harness.request({
        task: "extract_tables",
        file: "/path/to/document.docx",
        format: "json",
      });
      assertSuccess(response);
    });
  });

  describe("Conversion", () => {
    it("should accept a request to convert to PDF", async () => {
      const response = await harness.request({
        task: "convert_to_pdf",
        file: "/path/to/document.docx",
        output: "/path/to/document.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a request to convert to HTML", async () => {
      const response = await harness.request({
        task: "convert_to_html",
        file: "/path/to/document.docx",
        output: "/path/to/document.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to convert to Markdown", async () => {
      const response = await harness.request({
        task: "convert_to_markdown",
        file: "/path/to/document.docx",
        output: "/path/to/document.md",
      });
      assertSuccess(response);
    });
  });

  describe("Document Properties", () => {
    it("should accept a request to read properties", async () => {
      const response = await harness.request({
        task: "read_properties",
        file: "/path/to/document.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to update properties", async () => {
      const response = await harness.request({
        task: "update_properties",
        file: "/path/to/document.docx",
        properties: {
          title: "New Title",
          author: "New Author",
          subject: "New Subject",
          keywords: ["doc", "test"],
        },
        output: "/path/to/updated.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Headers and Footers", () => {
    it("should accept a request to add header", async () => {
      const response = await harness.request({
        task: "add_header",
        file: "/path/to/document.docx",
        text: "Company Name - Confidential",
        output: "/path/to/with-header.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add footer with page numbers", async () => {
      const response = await harness.request({
        task: "add_footer",
        file: "/path/to/document.docx",
        text: "Page {PAGE} of {NUMPAGES}",
        output: "/path/to/with-footer.docx",
      });
      assertSuccess(response);
    });
  });
});
