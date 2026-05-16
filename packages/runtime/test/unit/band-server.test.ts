import { describe, expect, test } from "bun:test";
import { randomId } from "../../src/random-id";

describe("band-server", () => {
  test("generates 16-character hex IDs", () => {
    expect(randomId()).toMatch(/^[0-9a-f]{16}$/);
  });

  test("does not use Math.random", () => {
    const originalRandom = Math.random;
    Math.random = () => {
      throw new Error("Math.random should not be used for workdir IDs");
    };

    try {
      expect(randomId()).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      Math.random = originalRandom;
    }
  });
});
