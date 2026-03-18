import { describe, test, expect } from "bun:test";
import type { BandDocument } from "@bands/format";
import { createBandApp } from "../src/app";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return {
    band: "test-band",
    icon: "🧪",
    description: "Test band",
    ...overrides,
  };
}

describe("GET /health", () => {
  test("returns not ready when no band loaded", async () => {
    const app = createBandApp();
    const res = await app.request("/health");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ready: false, band: null, version: null });
  });

  test("returns ready after init", async () => {
    const band = makeBand({ version: 1 });
    const app = createBandApp({ band });
    const res = await app.request("/health");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ready: true, band: "test-band", version: 1 });
  });
});

describe("POST /init", () => {
  test("initializes with a valid band", async () => {
    const app = createBandApp();
    const band = makeBand({ version: 2 });

    const res = await app.request("/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(band),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, band: "test-band", version: 2 });

    // Verify health now reports ready
    const health = await app.request("/health");
    const healthJson = await health.json();
    expect(healthJson.ready).toBe(true);
  });

  test("rejects missing required fields", async () => {
    const app = createBandApp();

    const res = await app.request("/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ band: "x" }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("INVALID_BAND");
  });

  test("rejects when description is missing", async () => {
    const app = createBandApp();

    const res = await app.request("/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ band: "x", icon: "🧪" }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("INVALID_BAND");
  });

  test("accepts band without version (version is optional)", async () => {
    const app = createBandApp();
    const band = makeBand(); // no version

    const res = await app.request("/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(band),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});

describe("POST /", () => {
  test("returns NOT_INITIALIZED when no band loaded", async () => {
    const app = createBandApp();

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "hello" }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("NOT_INITIALIZED");
  });

  test("executes and returns result with metrics headers", async () => {
    const band = makeBand();
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "hello" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.executed).toBe(true);
    expect(json.inputReceived).toEqual({ data: "hello" });

    // Verify metrics headers
    expect(res.headers.get("X-Band-Input-Bytes")).toBeTruthy();
    expect(res.headers.get("X-Band-Output-Bytes")).toBeTruthy();
    expect(res.headers.get("X-Band-Duration-Ms")).toBeTruthy();
  });

  test("rejects input that violates contract.input", async () => {
    const band = makeBand({
      contract: {
        input: { type: "object", properties: { required_field: { type: "string" } }, required: ["required_field"] },
      },
    });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unrelated: 42 }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("CONTRACT_INPUT_INVALID");
    expect(json.error.message).toContain("contract.input validation failed");
  });

  test("passes valid input through contract check", async () => {
    const band = makeBand({
      contract: {
        input: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      },
    });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "alice" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.executed).toBe(true);
  });

  test("rejects output that violates contract.output", async () => {
    const band = makeBand({
      contract: {
        output: { type: "object", properties: { result: { type: "number" } }, required: ["result"] },
      },
    });
    const app = createBandApp({ band });

    // The sandbox returns { executed: true, inputReceived: ... } which won't match the output schema
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "hello" }),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("CONTRACT_OUTPUT_INVALID");
    expect(json.error.message).toContain("contract.output validation failed");
  });

  test("skips contract enforcement for string schema refs", async () => {
    const band = makeBand({
      contract: {
        input: "./schemas/input.json",
        output: "https://example.com/output.json",
      },
    });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anything: true }),
    });
    const json = await res.json();

    // String refs are skipped — execution proceeds normally
    expect(res.status).toBe(200);
    expect(json.executed).toBe(true);
  });

  test("maxCostDollars is not enforced at runtime (stub)", async () => {
    const band = makeBand({
      limit: { maxCostDollars: 0.001 },
    });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "hello" }),
    });
    const json = await res.json();

    // Execution should still succeed — cost enforcement is not implemented
    expect(res.status).toBe(200);
    expect(json.executed).toBe(true);
  });
});

describe("GET /band", () => {
  test("returns NOT_INITIALIZED when no band loaded", async () => {
    const app = createBandApp();
    const res = await app.request("/band");
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("NOT_INITIALIZED");
  });

  test("returns the full band document after init", async () => {
    const band = makeBand({ version: 3, allow: { net: ["api.example.com"] } });
    const app = createBandApp({ band });

    const res = await app.request("/band");
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.band).toBe("test-band");
    expect(json.version).toBe(3);
    expect(json.allow.net).toEqual(["api.example.com"]);
  });
});

describe("CORS", () => {
  test("OPTIONS / returns CORS headers", async () => {
    const app = createBandApp();
    const res = await app.request("/", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });
});
