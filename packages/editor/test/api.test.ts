import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { apiRoutes } from "../src/api/routes";

const app = new Hono();
app.route("/api", apiRoutes);

describe("API routes", () => {
  test("POST /api/parse - valid BAND.md", async () => {
    const res = await app.request("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "---\nband: test\nicon: x\ndescription: test band\n---" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.document.band).toBe("test");
    expect(json.document.icon).toBe("x");
    expect(json.errors).toHaveLength(0);
  });

  test("POST /api/parse - invalid BAND.md", async () => {
    const res = await app.request("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "no frontmatter" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.errors.length).toBeGreaterThan(0);
  });

  test("POST /api/validate - valid document", async () => {
    const res = await app.request("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ band: "test", version: 1, icon: "🎵" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.errors).toHaveLength(0);
  });

  test("POST /api/export - produces BAND.md", async () => {
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ band: "test", version: 1, icon: "🎵" }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toStartWith("---\n");
    expect(text).toContain("band: test");
  });
});
