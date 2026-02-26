/**
 * Integration tests for the Brand Guidelines skill band.
 *
 * Tests applying Anthropic brand colors, typography, and styling.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("Brand Guidelines Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("brand-guidelines"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("brand-guidelines");
    });
  });

  describe("Color Application", () => {
    it("should accept a request to get brand colors", async () => {
      const response = await harness.request({
        task: "get_colors",
      });
      assertSuccess(response);
    });

    it("should accept a request to apply brand colors to HTML", async () => {
      const response = await harness.request({
        task: "apply_colors",
        file: "/path/to/page.html",
        output: "/path/to/branded-page.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to apply brand colors to CSS", async () => {
      const response = await harness.request({
        task: "apply_colors",
        file: "/path/to/styles.css",
        output: "/path/to/branded-styles.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate color variables", async () => {
      const response = await harness.request({
        task: "generate_color_variables",
        format: "css",
        output: "/path/to/brand-colors.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate color variables as SCSS", async () => {
      const response = await harness.request({
        task: "generate_color_variables",
        format: "scss",
        output: "/path/to/brand-colors.scss",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate color variables as JSON", async () => {
      const response = await harness.request({
        task: "generate_color_variables",
        format: "json",
        output: "/path/to/brand-colors.json",
      });
      assertSuccess(response);
    });
  });

  describe("Typography Application", () => {
    it("should accept a request to get brand typography", async () => {
      const response = await harness.request({
        task: "get_typography",
      });
      assertSuccess(response);
    });

    it("should accept a request to apply typography to HTML", async () => {
      const response = await harness.request({
        task: "apply_typography",
        file: "/path/to/page.html",
        output: "/path/to/typed-page.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate typography CSS", async () => {
      const response = await harness.request({
        task: "generate_typography",
        headingFont: "Poppins",
        bodyFont: "Lora",
        output: "/path/to/typography.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to include font imports", async () => {
      const response = await harness.request({
        task: "generate_font_imports",
        fonts: ["Poppins", "Lora"],
        weights: [400, 500, 600, 700],
        output: "/path/to/fonts.css",
      });
      assertSuccess(response);
    });
  });

  describe("PowerPoint Styling", () => {
    it("should accept a request to apply brand to PPTX", async () => {
      const response = await harness.request({
        task: "apply_to_pptx",
        file: "/path/to/presentation.pptx",
        output: "/path/to/branded-presentation.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to apply brand to specific slides", async () => {
      const response = await harness.request({
        task: "apply_to_pptx",
        file: "/path/to/presentation.pptx",
        slides: [1, 3, 5],
        output: "/path/to/partial-branded.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to update text styling in PPTX", async () => {
      const response = await harness.request({
        task: "style_pptx_text",
        file: "/path/to/presentation.pptx",
        headingStyle: {
          font: "Poppins",
          color: "#141413",
        },
        bodyStyle: {
          font: "Lora",
          color: "#141413",
        },
        output: "/path/to/text-styled.pptx",
      });
      assertSuccess(response);
    });

    it("should accept a request to apply accent colors to shapes", async () => {
      const response = await harness.request({
        task: "style_pptx_shapes",
        file: "/path/to/presentation.pptx",
        accentCycle: ["#d97757", "#6a9bcc", "#788c5d"],
        output: "/path/to/shape-styled.pptx",
      });
      assertSuccess(response);
    });
  });

  describe("Document Styling", () => {
    it("should accept a request to apply brand to DOCX", async () => {
      const response = await harness.request({
        task: "apply_to_docx",
        file: "/path/to/document.docx",
        output: "/path/to/branded-document.docx",
      });
      assertSuccess(response);
    });

    it("should accept a request to update heading styles in DOCX", async () => {
      const response = await harness.request({
        task: "style_docx_headings",
        file: "/path/to/document.docx",
        h1: { font: "Poppins", size: 24, color: "#141413" },
        h2: { font: "Poppins", size: 18, color: "#141413" },
        h3: { font: "Poppins", size: 14, color: "#141413" },
        output: "/path/to/heading-styled.docx",
      });
      assertSuccess(response);
    });
  });

  describe("Web Component Generation", () => {
    it("should accept a request to generate a branded button", async () => {
      const response = await harness.request({
        task: "generate_component",
        type: "button",
        variant: "primary",
        framework: "react",
        output: "/path/to/BrandedButton.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a branded card", async () => {
      const response = await harness.request({
        task: "generate_component",
        type: "card",
        framework: "html",
        output: "/path/to/branded-card.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a branded header", async () => {
      const response = await harness.request({
        task: "generate_component",
        type: "header",
        includeLogo: true,
        framework: "react",
        output: "/path/to/BrandedHeader.tsx",
      });
      assertSuccess(response);
    });
  });

  describe("Style Guides", () => {
    it("should accept a request to generate a style guide", async () => {
      const response = await harness.request({
        task: "generate_style_guide",
        format: "html",
        output: "/path/to/style-guide.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a color swatch page", async () => {
      const response = await harness.request({
        task: "generate_swatches",
        format: "svg",
        output: "/path/to/swatches.svg",
      });
      assertSuccess(response);
    });
  });

  describe("Theme Generation", () => {
    it("should accept a request to generate a light theme", async () => {
      const response = await harness.request({
        task: "generate_theme",
        mode: "light",
        format: "css",
        output: "/path/to/light-theme.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a dark theme", async () => {
      const response = await harness.request({
        task: "generate_theme",
        mode: "dark",
        format: "css",
        output: "/path/to/dark-theme.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate theme with custom accents", async () => {
      const response = await harness.request({
        task: "generate_theme",
        mode: "light",
        customAccent: "#d97757",
        format: "tailwind",
        output: "/path/to/tailwind.config.js",
      });
      assertSuccess(response);
    });
  });

  describe("Validation", () => {
    it("should accept a request to validate brand compliance", async () => {
      const response = await harness.request({
        task: "validate",
        file: "/path/to/page.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to check color contrast", async () => {
      const response = await harness.request({
        task: "check_contrast",
        foreground: "#141413",
        background: "#faf9f5",
      });
      assertSuccess(response);
    });

    it("should accept a request to validate font usage", async () => {
      const response = await harness.request({
        task: "validate_fonts",
        file: "/path/to/styles.css",
      });
      assertSuccess(response);
    });
  });

  describe("Asset Export", () => {
    it("should accept a request to export brand assets", async () => {
      const response = await harness.request({
        task: "export_assets",
        outputDir: "/path/to/assets/",
        include: ["colors", "typography", "logos"],
      });
      assertSuccess(response);
    });

    it("should accept a request to generate logo variations", async () => {
      const response = await harness.request({
        task: "generate_logos",
        variations: ["dark", "light", "monochrome"],
        formats: ["svg", "png"],
        outputDir: "/path/to/logos/",
      });
      assertSuccess(response);
    });
  });
});
