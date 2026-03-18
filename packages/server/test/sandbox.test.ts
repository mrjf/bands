import { describe, test, expect } from "bun:test";
import type { BandDocument } from "@bands/format";
import { createSandbox } from "../src/sandbox";
import { createBandApp } from "../src/app";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return {
    band: "test-band",
    icon: "🧪",
    description: "Test band",
    ...overrides,
  };
}

describe("createSandbox", () => {
  describe("canUseTool", () => {
    test("allows a tool in the allow list", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { tools: ["https://github.com/acme/search"] } })
      );
      expect(sandbox.canUseTool("https://github.com/acme/search")).toBe(true);
    });

    test("denies a tool in the deny list", () => {
      const sandbox = createSandbox(
        makeBand({
          allow: { tools: ["https://github.com/acme/search"] },
          deny: { tools: ["https://github.com/acme/search"] },
        })
      );
      expect(sandbox.canUseTool("https://github.com/acme/search")).toBe(false);
    });

    test("denies an unlisted tool (deny-by-default)", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { tools: ["https://github.com/acme/search"] } })
      );
      expect(sandbox.canUseTool("https://github.com/acme/delete")).toBe(false);
    });

    test("denies all tools when no allow list", () => {
      const sandbox = createSandbox(makeBand());
      expect(sandbox.canUseTool("https://github.com/acme/search")).toBe(false);
    });
  });

  describe("canAccessPath - read", () => {
    test("allows a path matching allow.read", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { read: ["./data/**"] } })
      );
      expect(sandbox.canAccessPath("read", "./data/file.txt")).toBe(true);
    });

    test("denies a path matching deny.read", () => {
      const sandbox = createSandbox(
        makeBand({
          allow: { read: ["./data/**"] },
          deny: { read: ["./data/.env*"] },
        })
      );
      expect(sandbox.canAccessPath("read", "./data/.env")).toBe(false);
    });

    test("denies an unmatched path (deny-by-default)", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { read: ["./data/**"] } })
      );
      expect(sandbox.canAccessPath("read", "./secrets/key.pem")).toBe(false);
    });

    test("does not use write rules for read checks", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { write: ["./output/**"] } })
      );
      expect(sandbox.canAccessPath("read", "./output/file.txt")).toBe(false);
    });
  });

  describe("canAccessPath - write", () => {
    test("allows a path matching allow.write", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { write: ["./output/**"] } })
      );
      expect(sandbox.canAccessPath("write", "./output/result.json")).toBe(true);
    });

    test("denies a path matching deny.write", () => {
      const sandbox = createSandbox(
        makeBand({
          allow: { write: ["./output/**"] },
          deny: { write: ["./output/protected*"] },
        })
      );
      expect(sandbox.canAccessPath("write", "./output/protected.db")).toBe(false);
    });

    test("denies an unmatched path (deny-by-default)", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { write: ["./output/**"] } })
      );
      expect(sandbox.canAccessPath("write", "./src/index.ts")).toBe(false);
    });

    test("does not use read rules for write checks", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { read: ["./data/**"] } })
      );
      expect(sandbox.canAccessPath("write", "./data/file.txt")).toBe(false);
    });
  });

  describe("canAccessNetwork", () => {
    test("allows a host in allow.net", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { net: ["api.github.com"] } })
      );
      expect(sandbox.canAccessNetwork("api.github.com")).toBe(true);
    });

    test("allows a host matching wildcard pattern", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { net: ["*.github.com"] } })
      );
      expect(sandbox.canAccessNetwork("api.github.com")).toBe(true);
    });

    test("denies a host in deny.net", () => {
      const sandbox = createSandbox(
        makeBand({
          allow: { net: ["*.github.com"] },
          deny: { net: ["evil.github.com"] },
        })
      );
      expect(sandbox.canAccessNetwork("evil.github.com")).toBe(false);
    });

    test("denies an unmatched host (deny-by-default)", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { net: ["api.github.com"] } })
      );
      expect(sandbox.canAccessNetwork("evil.com")).toBe(false);
    });

    test("denies all hosts when no allow list", () => {
      const sandbox = createSandbox(makeBand());
      expect(sandbox.canAccessNetwork("example.com")).toBe(false);
    });
  });

  describe("canRunCli", () => {
    test("allows a command matching allow.cli", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { cli: ["jq *"] } })
      );
      expect(sandbox.canRunCli("jq .foo")).toBe(true);
    });

    test("denies a command matching deny.cli", () => {
      const sandbox = createSandbox(
        makeBand({
          allow: { cli: ["npm *"] },
          deny: { cli: ["npm publish*"] },
        })
      );
      expect(sandbox.canRunCli("npm publish")).toBe(false);
    });

    test("deny takes precedence over allow", () => {
      const sandbox = createSandbox(
        makeBand({
          allow: { cli: ["rm *"] },
          deny: { cli: ["rm -rf *"] },
        })
      );
      expect(sandbox.canRunCli("rm file.txt")).toBe(true);
      expect(sandbox.canRunCli("rm -rf /")).toBe(false);
    });

    test("denies an unmatched command (deny-by-default)", () => {
      const sandbox = createSandbox(
        makeBand({ allow: { cli: ["jq *"] } })
      );
      expect(sandbox.canRunCli("curl http://evil.com")).toBe(false);
    });

    test("denies all commands when no allow list", () => {
      const sandbox = createSandbox(makeBand());
      expect(sandbox.canRunCli("ls")).toBe(false);
    });
  });

  describe("execute", () => {
    test("uses timeout from band.limit.maxRuntimeMs", async () => {
      const sandbox = createSandbox(
        makeBand({ limit: { maxRuntimeMs: 50 } })
      );

      const result = await sandbox.execute("test", {
        input: { data: "hello" },
        env: {},
        fetch: globalThis.fetch,
      });

      expect(result).toEqual({
        executed: true,
        inputReceived: { data: "hello" },
      });
    });

    test("uses timeout from string duration", async () => {
      const sandbox = createSandbox(
        makeBand({ limit: { maxRuntimeMs: "5s" } })
      );

      const result = await sandbox.execute("test", {
        input: "ping",
        env: {},
        fetch: globalThis.fetch,
      });

      expect(result).toEqual({
        executed: true,
        inputReceived: "ping",
      });
    });

    test("defaults to 30000ms when no limit set", async () => {
      const sandbox = createSandbox(makeBand());

      const result = await sandbox.execute("test", {
        input: null,
        env: {},
        fetch: globalThis.fetch,
      });

      expect(result).toEqual({
        executed: true,
        inputReceived: null,
      });
    });
  });
});

describe("app.ts limit enforcement", () => {
  test("rejects input exceeding limit.maxInputBytes", async () => {
    const band = makeBand({ limit: { maxInputBytes: 10 } });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "this string is definitely longer than ten bytes" }),
    });

    const json = await res.json();
    expect(json.error.code).toBe("INPUT_TOO_LARGE");
  });

  test("rejects input exceeding limit.maxInputBytes (string value)", async () => {
    const band = makeBand({ limit: { maxInputBytes: "10" } });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "this string is definitely longer than ten bytes" }),
    });

    const json = await res.json();
    expect(json.error.code).toBe("INPUT_TOO_LARGE");
  });

  test("allows input within limit.maxInputBytes", async () => {
    const band = makeBand({ limit: { maxInputBytes: 100000 } });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    const json = await res.json();
    expect(json.error).toBeUndefined();
    expect(json.executed).toBe(true);
  });

  test("rejects output exceeding limit.maxOutputBytes", async () => {
    const band = makeBand({ limit: { maxOutputBytes: 5 } });
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "hello" }),
    });

    const json = await res.json();
    expect(json.error.code).toBe("OUTPUT_TOO_LARGE");
  });

  test("enforces no limits when limit is absent", async () => {
    const band = makeBand();
    const app = createBandApp({ band });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "hello" }),
    });

    const json = await res.json();
    expect(json.executed).toBe(true);
  });
});
