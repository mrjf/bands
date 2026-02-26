/**
 * Integration tests for the PPTX skill band.
 *
 * Tests typical PowerPoint operations: creating presentations, adding slides,
 * text, images, charts, animations, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("PPTX Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("pptx"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("pptx");
    });
  });

  describe("Presentation Creation", () => {
    it("should accept a request to create an empty presentation", async () => {
      const response = await harness.request({
        task: "create",
        output: "/path/to/new.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create with title slide", async () => {
      const response = await harness.request({
        task: "create",
        title: "My Presentation",
        subtitle: "A subtitle here",
        output: "/path/to/titled.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create from template", async () => {
      const response = await harness.request({
        task: "create_from_template",
        template: "/path/to/template.pptx",
        replacements: {
          "{{title}}": "Quarterly Report",
          "{{date}}": "Q1 2024",
        },
        output: "/path/to/from-template.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Reading Presentations", () => {
    it("should accept a request to read slide content", async () => {
      const response = await harness.request({
        task: "read",
        file: "/path/to/presentation.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to list slides", async () => {
      const response = await harness.request({
        task: "list_slides",
        file: "/path/to/presentation.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to read specific slide", async () => {
      const response = await harness.request({
        task: "read_slide",
        file: "/path/to/presentation.pptx",
        slideNumber: 3,
      });
      assertSuccess(response);
    });

    it("should accept a request to extract text", async () => {
      const response = await harness.request({
        task: "extract_text",
        file: "/path/to/presentation.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Slide Management", () => {
    it("should accept a request to add a blank slide", async () => {
      const response = await harness.request({
        task: "add_slide",
        file: "/path/to/presentation.pptx",
        layout: "blank",
        output: "/path/to/with-slide.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add a title slide", async () => {
      const response = await harness.request({
        task: "add_slide",
        file: "/path/to/presentation.pptx",
        layout: "title",
        title: "New Section",
        output: "/path/to/with-title.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add a content slide", async () => {
      const response = await harness.request({
        task: "add_slide",
        file: "/path/to/presentation.pptx",
        layout: "title_and_content",
        title: "Key Points",
        content: ["Point 1", "Point 2", "Point 3"],
        output: "/path/to/with-content.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to duplicate a slide", async () => {
      const response = await harness.request({
        task: "duplicate_slide",
        file: "/path/to/presentation.pptx",
        slideNumber: 2,
        output: "/path/to/duplicated.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to delete a slide", async () => {
      const response = await harness.request({
        task: "delete_slide",
        file: "/path/to/presentation.pptx",
        slideNumber: 3,
        output: "/path/to/deleted.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to reorder slides", async () => {
      const response = await harness.request({
        task: "reorder_slides",
        file: "/path/to/presentation.pptx",
        order: [1, 3, 2, 4],
        output: "/path/to/reordered.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Text Operations", () => {
    it("should accept a request to add text box", async () => {
      const response = await harness.request({
        task: "add_text",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        text: "Hello World",
        position: { x: 100, y: 100 },
        size: { width: 200, height: 50 },
        output: "/path/to/with-text.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add formatted text", async () => {
      const response = await harness.request({
        task: "add_text",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        text: "Formatted Text",
        font: "Arial",
        fontSize: 24,
        bold: true,
        color: "#FF0000",
        output: "/path/to/formatted-text.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add bullet points", async () => {
      const response = await harness.request({
        task: "add_bullets",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        bullets: ["First point", "Second point", "Third point"],
        output: "/path/to/with-bullets.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Image Operations", () => {
    it("should accept a request to add an image", async () => {
      const response = await harness.request({
        task: "add_image",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        imagePath: "/path/to/image.png",
        position: { x: 100, y: 100 },
        output: "/path/to/with-image.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add image with size", async () => {
      const response = await harness.request({
        task: "add_image",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        imagePath: "/path/to/image.png",
        position: { x: 50, y: 50 },
        size: { width: 400, height: 300 },
        output: "/path/to/sized-image.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to set background image", async () => {
      const response = await harness.request({
        task: "set_background",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        imagePath: "/path/to/background.jpg",
        output: "/path/to/with-background.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Shapes", () => {
    it("should accept a request to add a rectangle", async () => {
      const response = await harness.request({
        task: "add_shape",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        shapeType: "rectangle",
        position: { x: 100, y: 100 },
        size: { width: 200, height: 100 },
        fillColor: "#4472C4",
        output: "/path/to/with-shape.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add a circle", async () => {
      const response = await harness.request({
        task: "add_shape",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        shapeType: "oval",
        position: { x: 200, y: 200 },
        size: { width: 100, height: 100 },
        output: "/path/to/with-circle.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add an arrow", async () => {
      const response = await harness.request({
        task: "add_shape",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        shapeType: "arrow",
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 300, y: 200 },
        output: "/path/to/with-arrow.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Charts", () => {
    it("should accept a request to add a bar chart", async () => {
      const response = await harness.request({
        task: "add_chart",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        chartType: "bar",
        data: {
          categories: ["Q1", "Q2", "Q3", "Q4"],
          series: [
            { name: "Sales", values: [100, 150, 120, 180] },
            { name: "Expenses", values: [80, 90, 100, 110] },
          ],
        },
        title: "Quarterly Performance",
        output: "/path/to/with-chart.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add a pie chart", async () => {
      const response = await harness.request({
        task: "add_chart",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        chartType: "pie",
        data: {
          categories: ["Product A", "Product B", "Product C"],
          values: [45, 30, 25],
        },
        title: "Market Share",
        output: "/path/to/pie-chart.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to add a line chart", async () => {
      const response = await harness.request({
        task: "add_chart",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        chartType: "line",
        data: {
          categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
          series: [{ name: "Trend", values: [10, 15, 13, 17, 20, 25] }],
        },
        title: "Growth Trend",
        output: "/path/to/line-chart.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Tables", () => {
    it("should accept a request to add a table", async () => {
      const response = await harness.request({
        task: "add_table",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        data: [
          ["Name", "Role", "Department"],
          ["Alice", "Engineer", "R&D"],
          ["Bob", "Designer", "UX"],
          ["Charlie", "Manager", "Ops"],
        ],
        position: { x: 50, y: 150 },
        output: "/path/to/with-table.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to style a table", async () => {
      const response = await harness.request({
        task: "add_table",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        data: [["A", "B"], ["1", "2"]],
        style: {
          headerBackground: "#4472C4",
          headerFontColor: "#FFFFFF",
          alternatingRows: true,
        },
        output: "/path/to/styled-table.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Conversion", () => {
    it("should accept a request to export as PDF", async () => {
      const response = await harness.request({
        task: "export_pdf",
        file: "/path/to/presentation.pptx",
        output: "/path/to/presentation.pdf",
      });
      assertSuccess(response);
    });

    it("should accept a request to export as images", async () => {
      const response = await harness.request({
        task: "export_images",
        file: "/path/to/presentation.pptx",
        outputDir: "/path/to/slides/",
        format: "png",
      });
      assertSuccess(response);
    });
  });

  describe("Speaker Notes", () => {
    it("should accept a request to add speaker notes", async () => {
      const response = await harness.request({
        task: "add_notes",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        notes: "Remember to emphasize the key points here.",
        output: "/path/to/with-notes.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to extract speaker notes", async () => {
      const response = await harness.request({
        task: "extract_notes",
        file: "/path/to/presentation.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Themes and Styling", () => {
    it("should accept a request to apply a theme", async () => {
      const response = await harness.request({
        task: "apply_theme",
        file: "/path/to/presentation.pptx",
        theme: "professional_blue",
        output: "/path/to/themed.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to set slide background color", async () => {
      const response = await harness.request({
        task: "set_background_color",
        file: "/path/to/presentation.pptx",
        slideNumber: 1,
        color: "#1E3A5F",
        output: "/path/to/colored-bg.pptx",
      });
      assertSuccess(response);
    });
  });
});
