import { describe, test, expect } from "bun:test";
import { validateContractSchema } from "../src/contract";

describe("validateContractSchema", () => {
  test("returns null for valid data", async () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    const result = await validateContractSchema({ name: "alice" }, schema, "test");
    expect(result).toBeNull();
  });

  test("returns error message for invalid data", async () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    const result = await validateContractSchema({}, schema, "contract.input");
    expect(result).not.toBeNull();
    expect(result).toContain("contract.input validation failed");
    expect(result).toContain("required");
  });

  test("includes path details for nested validation errors", async () => {
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: { age: { type: "number" } },
          required: ["age"],
        },
      },
      required: ["user"],
    };
    const result = await validateContractSchema(
      { user: { age: "not-a-number" } },
      schema,
      "contract.output"
    );
    expect(result).not.toBeNull();
    expect(result).toContain("/user/age");
    expect(result).toContain("contract.output validation failed");
  });

  test("reports all errors when multiple fields fail", async () => {
    const schema = {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["a", "b"],
    };
    const result = await validateContractSchema({}, schema, "test");
    expect(result).not.toBeNull();
    // allErrors: true means both missing fields are reported
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  test("validates primitive schemas", async () => {
    const schema = { type: "string" };
    expect(await validateContractSchema("hello", schema, "test")).toBeNull();
    expect(await validateContractSchema(42, schema, "test")).not.toBeNull();
  });
});
