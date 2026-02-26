/**
 * Integration tests for the Frontend Design skill band.
 *
 * Tests UI component generation, styling, layout creation, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  BandTestHarness,
  getWrappedSkillPath,
  assertSuccess,
} from "../runner";

describe("Frontend Design Skill Integration", () => {
  const harness = new BandTestHarness();

  beforeAll(async () => {
    await harness.init(getWrappedSkillPath("frontend-design"));
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe("Health Check", () => {
    it("should be ready after initialization", async () => {
      const health = await harness.health();
      expect(health.ready).toBe(true);
      expect(health.band).toBe("frontend-design");
    });
  });

  describe("Component Generation", () => {
    it("should accept a request to create a button component", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "button",
        props: {
          label: "Click Me",
          variant: "primary",
          size: "medium",
        },
        framework: "react",
        output: "/path/to/Button.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a card component", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "card",
        props: {
          title: "Card Title",
          description: "Card description text",
          image: true,
          actions: ["View", "Edit"],
        },
        framework: "react",
        output: "/path/to/Card.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a form component", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "form",
        fields: [
          { name: "email", type: "email", label: "Email", required: true },
          { name: "password", type: "password", label: "Password", required: true },
          { name: "remember", type: "checkbox", label: "Remember me" },
        ],
        framework: "react",
        output: "/path/to/LoginForm.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a navigation component", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "navbar",
        props: {
          logo: "My App",
          links: [
            { label: "Home", href: "/" },
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
          ],
          sticky: true,
        },
        framework: "html",
        output: "/path/to/Navbar.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a modal component", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "modal",
        props: {
          title: "Confirm Action",
          size: "medium",
          closable: true,
        },
        framework: "vue",
        output: "/path/to/Modal.vue",
      });
      assertSuccess(response);
    });
  });

  describe("Page Generation", () => {
    it("should accept a request to create a landing page", async () => {
      const response = await harness.request({
        task: "create_page",
        type: "landing",
        sections: [
          { type: "hero", headline: "Welcome", subheadline: "Get started today" },
          { type: "features", items: ["Fast", "Secure", "Scalable"] },
          { type: "cta", text: "Sign Up Now" },
        ],
        style: "modern",
        output: "/path/to/landing.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a dashboard page", async () => {
      const response = await harness.request({
        task: "create_page",
        type: "dashboard",
        layout: {
          sidebar: true,
          header: true,
          widgets: ["stats", "chart", "table", "activity"],
        },
        framework: "react",
        output: "/path/to/Dashboard.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a portfolio page", async () => {
      const response = await harness.request({
        task: "create_page",
        type: "portfolio",
        sections: ["about", "projects", "skills", "contact"],
        style: "minimal",
        output: "/path/to/portfolio.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a pricing page", async () => {
      const response = await harness.request({
        task: "create_page",
        type: "pricing",
        tiers: [
          { name: "Basic", price: 9, features: ["Feature 1", "Feature 2"] },
          { name: "Pro", price: 29, features: ["All Basic", "Feature 3", "Feature 4"], highlighted: true },
          { name: "Enterprise", price: "Custom", features: ["All Pro", "Custom integrations"] },
        ],
        output: "/path/to/Pricing.tsx",
      });
      assertSuccess(response);
    });
  });

  describe("Layout Creation", () => {
    it("should accept a request to create a grid layout", async () => {
      const response = await harness.request({
        task: "create_layout",
        type: "grid",
        columns: 3,
        gap: "1rem",
        responsive: {
          tablet: 2,
          mobile: 1,
        },
        output: "/path/to/GridLayout.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a sidebar layout", async () => {
      const response = await harness.request({
        task: "create_layout",
        type: "sidebar",
        sidebarWidth: "250px",
        position: "left",
        collapsible: true,
        output: "/path/to/SidebarLayout.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a holy grail layout", async () => {
      const response = await harness.request({
        task: "create_layout",
        type: "holy_grail",
        header: { height: "60px", sticky: true },
        footer: { height: "40px" },
        sidebar: { width: "200px" },
        output: "/path/to/Layout.css",
      });
      assertSuccess(response);
    });
  });

  describe("Styling", () => {
    it("should accept a request to create a color palette", async () => {
      const response = await harness.request({
        task: "create_styles",
        type: "color_palette",
        primary: "#3B82F6",
        mode: "complementary",
        output: "/path/to/colors.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to create typography styles", async () => {
      const response = await harness.request({
        task: "create_styles",
        type: "typography",
        headingFont: "Poppins",
        bodyFont: "Inter",
        scale: "modular",
        output: "/path/to/typography.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a theme", async () => {
      const response = await harness.request({
        task: "create_styles",
        type: "theme",
        name: "dark",
        colors: {
          background: "#1a1a2e",
          surface: "#16213e",
          primary: "#e94560",
          text: "#eaeaea",
        },
        output: "/path/to/dark-theme.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to create animations", async () => {
      const response = await harness.request({
        task: "create_styles",
        type: "animations",
        animations: [
          { name: "fadeIn", duration: "0.3s" },
          { name: "slideUp", duration: "0.4s" },
          { name: "pulse", duration: "2s", iterationCount: "infinite" },
        ],
        output: "/path/to/animations.css",
      });
      assertSuccess(response);
    });
  });

  describe("Design System", () => {
    it("should accept a request to create design tokens", async () => {
      const response = await harness.request({
        task: "create_design_system",
        type: "tokens",
        spacing: [4, 8, 12, 16, 24, 32, 48, 64],
        borderRadius: ["sm", "md", "lg", "full"],
        shadows: ["sm", "md", "lg", "xl"],
        output: "/path/to/tokens.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a component library", async () => {
      const response = await harness.request({
        task: "create_design_system",
        type: "library",
        components: ["button", "input", "card", "modal", "dropdown"],
        framework: "react",
        outputDir: "/path/to/components/",
      });
      assertSuccess(response);
    });
  });

  describe("Responsive Design", () => {
    it("should accept a request to create responsive breakpoints", async () => {
      const response = await harness.request({
        task: "create_responsive",
        breakpoints: {
          sm: "640px",
          md: "768px",
          lg: "1024px",
          xl: "1280px",
        },
        output: "/path/to/breakpoints.css",
      });
      assertSuccess(response);
    });

    it("should accept a request to make a component responsive", async () => {
      const response = await harness.request({
        task: "make_responsive",
        component: "/path/to/Component.tsx",
        adaptations: {
          mobile: { layout: "stack", fontSize: "smaller" },
          tablet: { layout: "grid-2" },
          desktop: { layout: "grid-4" },
        },
        output: "/path/to/ResponsiveComponent.tsx",
      });
      assertSuccess(response);
    });
  });

  describe("Accessibility", () => {
    it("should accept a request to add ARIA labels", async () => {
      const response = await harness.request({
        task: "add_accessibility",
        file: "/path/to/Component.tsx",
        output: "/path/to/AccessibleComponent.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to check contrast", async () => {
      const response = await harness.request({
        task: "check_contrast",
        foreground: "#333333",
        background: "#ffffff",
      });
      assertSuccess(response);
    });
  });

  describe("Interactive Elements", () => {
    it("should accept a request to create a carousel", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "carousel",
        props: {
          autoplay: true,
          interval: 5000,
          indicators: true,
          arrows: true,
        },
        framework: "html",
        output: "/path/to/Carousel.html",
      });
      assertSuccess(response);
    });

    it("should accept a request to create a tabs component", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "tabs",
        tabs: [
          { label: "Overview", id: "overview" },
          { label: "Features", id: "features" },
          { label: "Pricing", id: "pricing" },
        ],
        framework: "react",
        output: "/path/to/Tabs.tsx",
      });
      assertSuccess(response);
    });

    it("should accept a request to create an accordion", async () => {
      const response = await harness.request({
        task: "create_component",
        type: "accordion",
        items: [
          { title: "Section 1", content: "Content 1" },
          { title: "Section 2", content: "Content 2" },
        ],
        multiple: false,
        framework: "html",
        output: "/path/to/Accordion.html",
      });
      assertSuccess(response);
    });
  });
});
