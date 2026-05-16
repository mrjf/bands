import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(import.meta.dir, "../../src/band-server.ts"), "utf8");

describe("band-server", () => {
  test("generates workdir IDs with crypto random bytes", () => {
    expect(source).toContain('import { createHash, randomBytes } from "crypto";');
    expect(source).toContain('return randomBytes(8).toString("hex");');
    expect(source).not.toContain("Math.random()");
  });
});
