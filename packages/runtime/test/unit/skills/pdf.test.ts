/**
 * Integration tests for the PDF skill band.
 *
 * Tests typical PDF operations: reading, writing, merging, splitting, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assert,
  assertSuccess,
  type TestScenario,
} from "../runner";

describe("PDF Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("pdf"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("pdf");
      expect(health.error).toBeNull();
    });
  });

  describe("Text Extraction", () => {
    it("should accept a request to extract text from a PDF", async () => {
      const response = await harness.request({
        task: "extract_text",
        file: "/path/to/document.pdf",
      });
      assertSuccess(response);
      expect(response.body).toHaveProperty("success", true);
    });

    it("should accept a request to extract text from specific pages", async () => {
      const response = await harness.request({
        task: "extract_text",
        file: "/path/to/document.pdf",
        pages: [1, 2, 3],
      });
      assertSuccess(response);
    });

    it("should accept OCR request for scanned PDFs", async () => {
      const response = await harness.request({
        task: "ocr",
        file: "/path/to/scanned.pdf",
        language: "eng",
      });
      assertSuccess(response);
    });
  });

  describe("Table Extraction", () => {
    it("should accept a request to extract tables", async () => {
      const response = await harness.request({
        task: "extract_tables",
        file: "/path/to/document.pdf",
        outputFormat: "csv",
      });
      assertSuccess(response);
    });

    it("should accept a request to extract tables as JSON", async () => {
      const response = await harness.request({
        task: "extract_tables",
        file: "/path/to/document.pdf",
        outputFormat: "json",
      });
      assertSuccess(response);
    });
  });

  describe("PDF Manipulation", () => {
    it("should accept a merge request", async () => {
      const response = await harness.request({
        task: "merge",
        files: ["/path/to/doc1.pdf", "/path/to/doc2.pdf", "/path/to/doc3.pdf"],
        output: "/path/to/merged.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a split request", async () => {
      const response = await harness.request({
        task: "split",
        file: "/path/to/document.pdf",
        outputDir: "/path/to/output/",
      });
      assertSuccess(response);
    });

    it("should accept a rotate request", async () => {
      const response = await harness.request({
        task: "rotate",
        file: "/path/to/document.pdf",
        pages: [1, 3],
        degrees: 90,
        output: "/path/to/rotated.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a page extraction request", async () => {
      const response = await harness.request({
        task: "extract_pages",
        file: "/path/to/document.pdf",
        pages: [1, 5, 10],
        output: "/path/to/extracted.pdf",
      });
      assertSuccess(response);
    });
  });

  describe("PDF Creation", () => {
    it("should accept a request to create a PDF from text", async () => {
      const response = await harness.request({
        task: "create",
        content: "Hello, World! This is a test PDF.",
        output: "/path/to/new.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a PDF with formatting", async () => {
      const response = await harness.request({
        task: "create",
        content: {
          title: "Test Document",
          body: "This is the body text.",
          author: "Test Author",
        },
        output: "/path/to/formatted.pdf",
      });
      assertSuccess(response);
    });
  });

  describe("Watermarking", () => {
    it("should accept a watermark request", async () => {
      const response = await harness.request({
        task: "watermark",
        file: "/path/to/document.pdf",
        watermarkText: "CONFIDENTIAL",
        output: "/path/to/watermarked.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a watermark request with image", async () => {
      const response = await harness.request({
        task: "watermark",
        file: "/path/to/document.pdf",
        watermarkImage: "/path/to/logo.png",
        opacity: 0.5,
        output: "/path/to/watermarked.pdf",
      });
      assertSuccess(response);
    });
  });

  describe("Security Operations", () => {
    it("should accept an encrypt request", async () => {
      const response = await harness.request({
        task: "encrypt",
        file: "/path/to/document.pdf",
        password: "secretpassword",
        output: "/path/to/encrypted.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a decrypt request", async () => {
      const response = await harness.request({
        task: "decrypt",
        file: "/path/to/encrypted.pdf",
        password: "secretpassword",
        output: "/path/to/decrypted.pdf",
      });
      assertSuccess(response);
    });
  });

  describe("Image Extraction", () => {
    it("should accept an image extraction request", async () => {
      const response = await harness.request({
        task: "extract_images",
        file: "/path/to/document.pdf",
        outputDir: "/path/to/images/",
        format: "png",
      });
      assertSuccess(response);
    });
  });

  describe("Metadata Operations", () => {
    it("should accept a metadata read request", async () => {
      const response = await harness.request({
        task: "read_metadata",
        file: "/path/to/document.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a metadata update request", async () => {
      const response = await harness.request({
        task: "update_metadata",
        file: "/path/to/document.pdf",
        metadata: {
          title: "New Title",
          author: "New Author",
          subject: "Test Subject",
        },
        output: "/path/to/updated.pdf",
      });
      assertSuccess(response);
    });
  });

  describe("Form Filling", () => {
    it("should accept a form field listing request", async () => {
      const response = await harness.request({
        task: "list_form_fields",
        file: "/path/to/form.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a form fill request", async () => {
      const response = await harness.request({
        task: "fill_form",
        file: "/path/to/form.pdf",
        fields: {
          name: "John Doe",
          email: "john@example.com",
          date: "2024-01-15",
        },
        output: "/path/to/filled.pdf",
      });
      assertSuccess(response);
    });
  });
});
