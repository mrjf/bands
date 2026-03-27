/**
 * Schema loader — unit tests.
 *
 * Tests centralized schema loading, $ref resolution via Ajv,
 * caching, bandConfig schema, and error cases.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { join } from "path";
import {
  loadSchemas,
  loadSchemaDefs,
  loadBandConfigSchema,
  createValidator,
  clearValidatorCache,
} from "../../../src/banded-skills/schema-loader";

const FIXTURES = join(import.meta.dir, "../../fixtures/banded-skills");
const VALID_SKILL = join(FIXTURES, "valid-skill");
const CONFIG_SKILL = join(FIXTURES, "config-skill");
const REF_SKILL = join(FIXTURES, "ref-skill");
const INVALID_SKILL = join(FIXTURES, "invalid-skill");

afterEach(() => {
  clearValidatorCache();
});

// ---------------------------------------------------------------------------
// loadSchemas
// ---------------------------------------------------------------------------
describe("loadSchemas", () => {
  test("loads input and output schemas from centralized dir", () => {
    const schemas = loadSchemas(VALID_SKILL, "echo-input");
    expect(schemas.input).toBeDefined();
    expect(schemas.output).toBeDefined();
    expect((schemas.input as any).type).toBe("object");
    expect((schemas.input as any).required).toContain("message");
  });

  test("returns empty object for nonexistent script", () => {
    const schemas = loadSchemas(VALID_SKILL, "nonexistent-script");
    expect(schemas.input).toBeUndefined();
    expect(schemas.output).toBeUndefined();
  });

  test("loads schemas with $ref fields", () => {
    const schemas = loadSchemas(REF_SKILL, "ref-echo");
    expect(schemas.input).toBeDefined();
    expect(schemas.output).toBeDefined();
    // Input schema references greeting.json and name.json defs
    expect((schemas.input as any).properties.greeting.$ref).toBe("greeting.json");
    expect((schemas.input as any).properties.name.$ref).toBe("name.json");
    // Output schema references echo-result.json def
    expect((schemas.output as any).$ref).toBe("echo-result.json");
  });

  test("loads input-only when output is missing", () => {
    // bad-ref has input schema but no output
    const schemas = loadSchemas(INVALID_SKILL, "bad-ref");
    expect(schemas.input).toBeDefined();
    expect(schemas.output).toBeUndefined();
  });

  test("throws on invalid JSON in schema file", () => {
    // broken.json is intentionally invalid JSON
    expect(() => loadSchemas(INVALID_SKILL, "broken")).toThrow();
  });

  test("returns empty for nonexistent skillRoot", () => {
    const schemas = loadSchemas("/nonexistent/path", "anything");
    expect(schemas.input).toBeUndefined();
    expect(schemas.output).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// loadSchemaDefs
// ---------------------------------------------------------------------------
describe("loadSchemaDefs", () => {
  test("loads all defs from schemas/defs/", () => {
    const defs = loadSchemaDefs(REF_SKILL);
    expect(defs.length).toBe(5); // echo-result.json, greeting.json, limit.json, name.json, verbose.json
    const ids = defs.map((d) => (d as any).$id).sort();
    expect(ids).toEqual(["echo-result.json", "greeting.json", "limit.json", "name.json", "verbose.json"]);
  });

  test("returns empty array when no defs dir exists", () => {
    const defs = loadSchemaDefs(VALID_SKILL);
    expect(defs).toEqual([]);
  });

  test("returns empty array for nonexistent skillRoot", () => {
    const defs = loadSchemaDefs("/nonexistent/path");
    expect(defs).toEqual([]);
  });

  test("every def has a $id field", () => {
    const defs = loadSchemaDefs(REF_SKILL);
    for (const def of defs) {
      expect((def as any).$id).toBeDefined();
      expect(typeof (def as any).$id).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// loadBandConfigSchema
// ---------------------------------------------------------------------------
describe("loadBandConfigSchema", () => {
  test("loads band-config schema when present", () => {
    const schema = loadBandConfigSchema(CONFIG_SKILL);
    expect(schema).not.toBeNull();
    expect((schema as any).type).toBe("object");
    expect((schema as any).properties["feature-a"]).toBeDefined();
  });

  test("returns null when no band-config schema", () => {
    const schema = loadBandConfigSchema(VALID_SKILL);
    expect(schema).toBeNull();
  });

  test("returns null for nonexistent skillRoot", () => {
    const schema = loadBandConfigSchema("/nonexistent/path");
    expect(schema).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createValidator
// ---------------------------------------------------------------------------
describe("createValidator", () => {
  test("creates Ajv instance with defs pre-loaded", async () => {
    const ajv = await createValidator(REF_SKILL);
    // defs should be registered — getSchema returns the compiled validator
    expect(ajv.getSchema("greeting.json")).toBeDefined();
    expect(ajv.getSchema("name.json")).toBeDefined();
    expect(ajv.getSchema("echo-result.json")).toBeDefined();
  });

  test("caches validator per skillRoot", async () => {
    const ajv1 = await createValidator(REF_SKILL);
    const ajv2 = await createValidator(REF_SKILL);
    expect(ajv1).toBe(ajv2); // same instance
  });

  test("different skillRoots get different validators", async () => {
    const ajv1 = await createValidator(REF_SKILL);
    const ajv2 = await createValidator(VALID_SKILL);
    expect(ajv1).not.toBe(ajv2);
  });

  test("clearValidatorCache forces re-creation", async () => {
    const ajv1 = await createValidator(REF_SKILL);
    clearValidatorCache();
    const ajv2 = await createValidator(REF_SKILL);
    expect(ajv1).not.toBe(ajv2);
  });

  test("works for skills without defs", async () => {
    const ajv = await createValidator(VALID_SKILL);
    expect(ajv).toBeDefined();
    // Should compile a simple schema without $ref
    const schemas = loadSchemas(VALID_SKILL, "echo-input");
    const validate = ajv.compile(schemas.input!);
    expect(validate({ message: "hello" })).toBe(true);
    expect(validate({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// $ref resolution — compile and validate real data
// ---------------------------------------------------------------------------
describe("$ref resolution", () => {
  test("compiles input schema with $ref defs", async () => {
    const ajv = await createValidator(REF_SKILL);
    const schemas = loadSchemas(REF_SKILL, "ref-echo");
    const validate = ajv.compile(schemas.input!);

    // Valid: has required "name" field
    expect(validate({ name: "Alice", greeting: "Hello" })).toBe(true);
    // Valid: greeting is optional
    expect(validate({ name: "Bob" })).toBe(true);
    // Invalid: missing required "name"
    expect(validate({ greeting: "Hello" })).toBe(false);
    // Invalid: name must be string (from name.json def)
    expect(validate({ name: 42 })).toBe(false);
    // Invalid: name must be minLength 1 (from name.json def)
    expect(validate({ name: "" })).toBe(false);
  });

  test("compiles output schema with $ref to composite def", async () => {
    const ajv = await createValidator(REF_SKILL);
    const schemas = loadSchemas(REF_SKILL, "ref-echo");
    const validate = ajv.compile(schemas.output!);

    // Valid: matches echo-result.json (greeting + name required)
    expect(validate({ greeting: "Hello", name: "Alice" })).toBe(true);
    // Invalid: missing required name
    expect(validate({ greeting: "Hello" })).toBe(false);
    // Invalid: missing required greeting
    expect(validate({ name: "Alice" })).toBe(false);
  });

  test("def referencing another def resolves correctly", async () => {
    // echo-result.json references greeting.json and name.json
    const ajv = await createValidator(REF_SKILL);
    const echoResult = ajv.getSchema("echo-result.json");
    expect(echoResult).toBeDefined();

    expect(echoResult!({ greeting: "Hi", name: "Alice" })).toBe(true);
    expect(echoResult!({ greeting: 42, name: "Alice" })).toBe(false);
    expect(echoResult!({ greeting: "Hi", name: "" })).toBe(false); // minLength 1
  });

  test("broken $ref throws on compile", async () => {
    const ajv = await createValidator(INVALID_SKILL);
    const schemas = loadSchemas(INVALID_SKILL, "bad-ref");
    // bad-ref.json references nonexistent-def.json which isn't registered
    expect(() => ajv.compile(schemas.input!)).toThrow();
  });

  test("github skill schemas compile with $ref defs", async () => {
    const githubRoot = join(import.meta.dir, "../../../../../skills/github");
    const ajv = await createValidator(githubRoot);

    // Compile a schema that uses $ref (issue-close uses repo.json and issue-number.json)
    const schemas = loadSchemas(githubRoot, "issue-close");
    expect(schemas.input).toBeDefined();
    const validate = ajv.compile(schemas.input!);

    // Valid input
    expect(validate({ repo: "owner/repo", number: 42 })).toBe(true);
    // Invalid: missing required repo
    expect(validate({ number: 42 })).toBe(false);
    // Invalid: missing required number
    expect(validate({ repo: "owner/repo" })).toBe(false);
  });

  test("slack skill schemas compile with $ref defs", async () => {
    const slackRoot = join(import.meta.dir, "../../../../../skills/slack");
    const ajv = await createValidator(slackRoot);

    // message-send uses channel.json ref
    const schemas = loadSchemas(slackRoot, "message-send");
    expect(schemas.input).toBeDefined();
    const validate = ajv.compile(schemas.input!);

    // Valid input
    expect(validate({ channel: "#general", text: "hello" })).toBe(true);
    // Invalid: missing channel
    expect(validate({ text: "hello" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// bandConfig validation end-to-end
// ---------------------------------------------------------------------------
describe("bandConfig validation", () => {
  test("validates valid bandConfig against schema", async () => {
    const ajv = await createValidator(CONFIG_SKILL);
    const schema = loadBandConfigSchema(CONFIG_SKILL);
    expect(schema).not.toBeNull();

    const validate = ajv.compile(schema!);
    expect(validate({ "feature-a": true, "feature-b": false, items: ["x"] })).toBe(true);
  });

  test("rejects invalid bandConfig", async () => {
    const ajv = await createValidator(CONFIG_SKILL);
    const schema = loadBandConfigSchema(CONFIG_SKILL);
    const validate = ajv.compile(schema!);

    // additionalProperties: false in config-skill schema
    expect(validate({ "feature-a": true, unknown: "bad" })).toBe(false);
  });

  test("rejects wrong types in bandConfig", async () => {
    const ajv = await createValidator(CONFIG_SKILL);
    const schema = loadBandConfigSchema(CONFIG_SKILL);
    const validate = ajv.compile(schema!);

    // feature-a should be boolean, not string
    expect(validate({ "feature-a": "yes" })).toBe(false);
    // items should be array, not string
    expect(validate({ items: "not-an-array" })).toBe(false);
  });

  test("slack bandConfig validates channels structure", async () => {
    const slackRoot = join(import.meta.dir, "../../../../../skills/slack");
    const ajv = await createValidator(slackRoot);
    const schema = loadBandConfigSchema(slackRoot);
    expect(schema).not.toBeNull();

    const validate = ajv.compile(schema!);

    // Valid slack bandConfig
    expect(
      validate({
        channels: { allow: ["#general"], deny: ["#secret"] },
        dm: true,
        threads: true,
        reactions: true,
        files: false,
        search: true,
      })
    ).toBe(true);

    // Invalid: extra property in channels
    expect(
      validate({
        channels: { allow: ["#general"], unknown: true },
      })
    ).toBe(false);

    // Invalid: dm should be boolean
    expect(validate({ dm: "yes" })).toBe(false);
  });
});
