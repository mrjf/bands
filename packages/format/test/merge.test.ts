import { describe, test, expect } from "bun:test";
import { union, intersect, removeItems } from "../src/merge";

describe("union", () => {
  test("empty arrays", () => {
    expect(union([], [])).toEqual([]);
  });

  test("merges and deduplicates", () => {
    expect(union(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  test("sorts stably", () => {
    expect(union(["c", "a"], ["b"])).toEqual(["a", "b", "c"]);
  });

  test("handles single array", () => {
    expect(union(["b", "a"])).toEqual(["a", "b"]);
  });

  test("handles multiple arrays", () => {
    expect(union(["a"], ["b"], ["c"])).toEqual(["a", "b", "c"]);
  });
});

describe("intersect", () => {
  test("empty arrays", () => {
    expect(intersect([], [])).toEqual([]);
  });

  test("no overlap", () => {
    expect(intersect(["a"], ["b"])).toEqual([]);
  });

  test("partial overlap", () => {
    expect(intersect(["a", "b", "c"], ["b", "c", "d"])).toEqual(["b", "c"]);
  });

  test("full overlap", () => {
    expect(intersect(["a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("removeItems", () => {
  test("removes matching items", () => {
    expect(removeItems(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  test("no matches to remove", () => {
    expect(removeItems(["a", "b"], ["c"])).toEqual(["a", "b"]);
  });

  test("empty source", () => {
    expect(removeItems([], ["a"])).toEqual([]);
  });

  test("empty remove list", () => {
    expect(removeItems(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
