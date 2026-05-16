import { describe, expect, test } from "bun:test";
import { checkInsistFromOps } from "../../src/band-server";

describe("band-server insist tracking", () => {
  test("matches write operations with glob patterns without scanning the host", () => {
    const result = checkInsistFromOps(
      { write: ["./output/**"] },
      "/tmp/band-exec-test",
      ["write:/tmp/band-exec-test/output/file.txt"]
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
  });

  test("requires a tracked write operation for insist.write", () => {
    const result = checkInsistFromOps(
      { write: ["/tmp/output/required.txt"] },
      "/tmp/band-exec-test",
      ["write:/tmp/output/other.txt"]
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toEqual(["write: /tmp/output/required.txt"]);
  });

  test("matches read operations with glob patterns", () => {
    const result = checkInsistFromOps(
      { read: ["data/**"] },
      "/tmp/band-exec-test",
      ["read:data/input.json"]
    );

    expect(result).toEqual({ satisfied: true, missing: [] });
  });

  test("does not satisfy insist.read from unrelated command substrings", () => {
    const result = checkInsistFromOps(
      { read: ["data/**"] },
      "/tmp/band-exec-test",
      ["echo data/"]
    );

    expect(result.satisfied).toBe(false);
    expect(result.missing).toEqual(["read: data/**"]);
  });
});
