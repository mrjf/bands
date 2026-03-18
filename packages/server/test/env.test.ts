import { describe, test, expect } from "bun:test";
import type { BandDocument } from "@bands/format";
import { createSandbox } from "../src/sandbox";

function makeBand(overrides: Partial<BandDocument> = {}): BandDocument {
  return {
    band: "test-band",
    icon: "🧪",
    description: "Test band",
    ...overrides,
  };
}

describe("getAllowedEnv", () => {
  test("returns empty object when band has no env config", () => {
    const sandbox = createSandbox(makeBand());
    expect(sandbox.getAllowedEnv()).toEqual({});
  });

  test("returns empty object even when band has env config (stub — not yet implemented)", () => {
    const sandbox = createSandbox(
      makeBand({
        env: {
          secrets: ["API_KEY", "DB_PASSWORD"],
          variables: ["NODE_ENV=production", "LOG_LEVEL=debug"],
        },
      })
    );

    // This documents that env is currently a stub.
    // When env support is implemented, this test will break — update it to verify real behavior.
    expect(sandbox.getAllowedEnv()).toEqual({});
  });
});
