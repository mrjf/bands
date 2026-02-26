/**
 * Integration tests for the Algorithmic Art skill band.
 *
 * Tests generative art creation, pattern generation, visual effects, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("Algorithmic Art Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("algorithmic-art"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("algorithmic-art");
    });
  });

  describe("Basic Shape Generation", () => {
    it("should accept a request to generate circles", async () => {
      const response = await harness.request({
        task: "generate",
        type: "circles",
        count: 50,
        colorScheme: "rainbow",
        size: { width: 800, height: 600 },
        output: "/path/to/circles.svg",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate rectangles", async () => {
      const response = await harness.request({
        task: "generate",
        type: "rectangles",
        count: 30,
        colorScheme: "monochrome",
        size: { width: 1000, height: 1000 },
        output: "/path/to/rectangles.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate polygons", async () => {
      const response = await harness.request({
        task: "generate",
        type: "polygons",
        sides: 6,
        count: 20,
        colorScheme: "complementary",
        output: "/path/to/hexagons.svg",
      });
      assertSuccess(response);
    });
  });

  describe("Pattern Generation", () => {
    it("should accept a request to generate a tiling pattern", async () => {
      const response = await harness.request({
        task: "pattern",
        type: "tiling",
        tileType: "penrose",
        colors: ["#FF6B6B", "#4ECDC4", "#45B7D1"],
        size: { width: 1000, height: 1000 },
        output: "/path/to/tiling.svg",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a fractal pattern", async () => {
      const response = await harness.request({
        task: "pattern",
        type: "fractal",
        fractalType: "mandelbrot",
        iterations: 100,
        colorMap: "viridis",
        center: { x: -0.5, y: 0 },
        zoom: 1.5,
        size: { width: 1920, height: 1080 },
        output: "/path/to/mandelbrot.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a Julia set", async () => {
      const response = await harness.request({
        task: "pattern",
        type: "fractal",
        fractalType: "julia",
        constant: { real: -0.7, imaginary: 0.27015 },
        iterations: 200,
        colorMap: "plasma",
        output: "/path/to/julia.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate noise patterns", async () => {
      const response = await harness.request({
        task: "pattern",
        type: "noise",
        noiseType: "perlin",
        scale: 0.05,
        octaves: 4,
        colorMap: "terrain",
        output: "/path/to/perlin.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate cellular automata", async () => {
      const response = await harness.request({
        task: "pattern",
        type: "cellular",
        rule: 110,
        generations: 200,
        width: 400,
        output: "/path/to/cellular.png",
      });
      assertSuccess(response);
    });
  });

  describe("Geometric Art", () => {
    it("should accept a request to generate a spirograph", async () => {
      const response = await harness.request({
        task: "geometric",
        type: "spirograph",
        outerRadius: 300,
        innerRadius: 150,
        penOffset: 100,
        rotations: 50,
        color: "#FF5733",
        output: "/path/to/spirograph.svg",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate L-system art", async () => {
      const response = await harness.request({
        task: "geometric",
        type: "l-system",
        axiom: "F",
        rules: { F: "F+F-F-F+F" },
        angle: 90,
        iterations: 4,
        output: "/path/to/koch.svg",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a tree fractal", async () => {
      const response = await harness.request({
        task: "geometric",
        type: "tree",
        depth: 10,
        branchAngle: 25,
        lengthRatio: 0.7,
        colorGradient: ["#8B4513", "#228B22"],
        output: "/path/to/tree.svg",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a Voronoi diagram", async () => {
      const response = await harness.request({
        task: "geometric",
        type: "voronoi",
        points: 100,
        colorScheme: "pastel",
        strokeWidth: 2,
        output: "/path/to/voronoi.svg",
      });
      assertSuccess(response);
    });
  });

  describe("Particle Systems", () => {
    it("should accept a request to generate flow field art", async () => {
      const response = await harness.request({
        task: "particles",
        type: "flow_field",
        particles: 1000,
        steps: 200,
        noiseScale: 0.01,
        colorScheme: "ocean",
        output: "/path/to/flow.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a particle explosion", async () => {
      const response = await harness.request({
        task: "particles",
        type: "explosion",
        particles: 500,
        frames: 60,
        colors: ["#FF0000", "#FF7700", "#FFFF00"],
        outputDir: "/path/to/explosion/",
        format: "gif",
      });
      assertSuccess(response);
    });
  });

  describe("Generative Text Art", () => {
    it("should accept a request to generate ASCII art", async () => {
      const response = await harness.request({
        task: "text_art",
        type: "ascii",
        sourceImage: "/path/to/image.jpg",
        width: 80,
        characters: "@#%*+=-:. ",
        output: "/path/to/ascii.txt",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate word cloud", async () => {
      const response = await harness.request({
        task: "text_art",
        type: "word_cloud",
        words: [
          { text: "Art", weight: 100 },
          { text: "Code", weight: 80 },
          { text: "Creative", weight: 60 },
          { text: "Algorithm", weight: 50 },
        ],
        shape: "circle",
        output: "/path/to/wordcloud.svg",
      });
      assertSuccess(response);
    });
  });

  describe("Color Manipulation", () => {
    it("should accept a request to generate a color palette", async () => {
      const response = await harness.request({
        task: "colors",
        type: "palette",
        algorithm: "complementary",
        baseColor: "#3498DB",
        count: 5,
        output: "/path/to/palette.json",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate a gradient", async () => {
      const response = await harness.request({
        task: "colors",
        type: "gradient",
        colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"],
        steps: 100,
        mode: "linear",
        output: "/path/to/gradient.svg",
      });
      assertSuccess(response);
    });
  });

  describe("Animation", () => {
    it("should accept a request to generate an animated pattern", async () => {
      const response = await harness.request({
        task: "animate",
        type: "pattern",
        pattern: "wave",
        frames: 60,
        fps: 30,
        size: { width: 400, height: 400 },
        output: "/path/to/wave.gif",
      });
      assertSuccess(response);
    });

    it("should accept a request to generate morphing shapes", async () => {
      const response = await harness.request({
        task: "animate",
        type: "morph",
        startShape: "circle",
        endShape: "star",
        frames: 30,
        easing: "easeInOut",
        output: "/path/to/morph.gif",
      });
      assertSuccess(response);
    });
  });

  describe("Image Processing", () => {
    it("should accept a request to apply halftone effect", async () => {
      const response = await harness.request({
        task: "effect",
        type: "halftone",
        sourceImage: "/path/to/image.jpg",
        dotSize: 5,
        angle: 45,
        output: "/path/to/halftone.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to apply pixelation", async () => {
      const response = await harness.request({
        task: "effect",
        type: "pixelate",
        sourceImage: "/path/to/image.jpg",
        pixelSize: 10,
        output: "/path/to/pixelated.png",
      });
      assertSuccess(response);
    });

    it("should accept a request to posterize an image", async () => {
      const response = await harness.request({
        task: "effect",
        type: "posterize",
        sourceImage: "/path/to/image.jpg",
        levels: 4,
        output: "/path/to/posterized.png",
      });
      assertSuccess(response);
    });
  });

  describe("Combinatorial Art", () => {
    it("should accept a request to generate a layered composition", async () => {
      const response = await harness.request({
        task: "compose",
        layers: [
          { type: "noise", noiseType: "simplex", opacity: 0.5 },
          { type: "circles", count: 20, opacity: 0.7 },
          { type: "lines", count: 50, opacity: 0.3 },
        ],
        blendMode: "multiply",
        size: { width: 1000, height: 1000 },
        output: "/path/to/composition.png",
      });
      assertSuccess(response);
    });
  });

  describe("Export Options", () => {
    it("should accept a request to export as SVG", async () => {
      const response = await harness.request({
        task: "generate",
        type: "circles",
        count: 10,
        output: "/path/to/output.svg",
        format: "svg",
      });
      assertSuccess(response);
    });

    it("should accept a request to export as PNG with custom resolution", async () => {
      const response = await harness.request({
        task: "generate",
        type: "fractal",
        output: "/path/to/output.png",
        format: "png",
        resolution: { width: 4000, height: 3000 },
        dpi: 300,
      });
      assertSuccess(response);
    });
  });
});
