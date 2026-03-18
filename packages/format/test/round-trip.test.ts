import { describe, test, expect } from "bun:test";
import { parseBandMd } from "../src/parse";
import { exportBandMd } from "../src/export";
import type { BandDocument } from "../src/types";

describe("round-trip", () => {
  test("parse → export → parse produces same document", () => {
    const source = `---
icon: "🔄"
band: round-trip
description: Round-trip test
allow:
  tools:
    - https://github.com/acme/tools/tree/main/a
    - https://github.com/acme/tools/tree/main/b
deny:
  tools:
    - https://github.com/acme/tools/tree/main/c
limit:
  maxInputBytes: 1024
  maxRuntimeMs: 5000
---`;

    const result1 = parseBandMd(source);
    expect(result1.errors).toHaveLength(0);

    const exported = exportBandMd(result1.document);
    const result2 = parseBandMd(exported);
    expect(result2.errors).toHaveLength(0);

    // Compare documents (ignoring body which may differ in whitespace)
    const doc1 = stripBody(result1.document);
    const doc2 = stripBody(result2.document);
    expect(doc2).toEqual(doc1);
  });

  test("round-trips contract property", () => {
    const source = `---
icon: "📋"
band: contract-test
description: Contract round-trip test
contract:
  input:
    type: object
    properties:
      message:
        type: string
    required:
      - message
  output:
    type: object
    properties:
      result:
        type: string
---`;

    const result1 = parseBandMd(source);
    expect(result1.errors).toHaveLength(0);
    expect(result1.document.contract).toBeDefined();
    expect(result1.document.contract!.input).toBeDefined();
    expect(result1.document.contract!.output).toBeDefined();

    const exported = exportBandMd(result1.document);
    const result2 = parseBandMd(exported);
    expect(result2.errors).toHaveLength(0);

    const doc1 = stripBody(result1.document);
    const doc2 = stripBody(result2.document);
    expect(doc2).toEqual(doc1);
  });

  test("round-trips contract with path and URL refs", () => {
    const source = `---
icon: "📋"
band: contract-ref-test
description: Contract ref round-trip test
contract:
  input: ./schemas/input.json
  output: https://example.com/out.json
---`;

    const result1 = parseBandMd(source);
    expect(result1.errors).toHaveLength(0);
    expect(result1.document.contract).toBeDefined();
    expect(result1.document.contract!.input).toBe("./schemas/input.json");
    expect(result1.document.contract!.output).toBe("https://example.com/out.json");

    const exported = exportBandMd(result1.document);
    const result2 = parseBandMd(exported);
    expect(result2.errors).toHaveLength(0);

    const doc1 = stripBody(result1.document);
    const doc2 = stripBody(result2.document);
    expect(doc2).toEqual(doc1);
  });

  test("round-trips version field", () => {
    const source = `---
icon: "📦"
band: versioned
description: Version round-trip test
version: 3
---`;

    const result1 = parseBandMd(source);
    expect(result1.errors).toHaveLength(0);
    expect(result1.document.version).toBe(3);

    const exported = exportBandMd(result1.document);
    const result2 = parseBandMd(exported);
    expect(result2.errors).toHaveLength(0);

    const doc1 = stripBody(result1.document);
    const doc2 = stripBody(result2.document);
    expect(doc2).toEqual(doc1);
  });

  test("export is idempotent", () => {
    const doc: BandDocument = {
      band: "idempotent",
      icon: "🎯",
      description: "Idempotent test",
      allow: {
        tools: ["https://github.com/acme/tools/tree/main/b", "https://github.com/acme/tools/tree/main/a"],
      },
      deny: {
        tools: ["https://github.com/acme/tools/tree/main/c"],
      },
    };

    const export1 = exportBandMd(doc);
    const parsed = parseBandMd(export1);
    const export2 = exportBandMd(parsed.document);
    expect(export2).toBe(export1);
  });
});

function stripBody(doc: BandDocument): Omit<BandDocument, "body"> {
  const { body, ...rest } = doc;
  return rest;
}
