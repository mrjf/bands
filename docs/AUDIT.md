# Documentation & Implementation Audit

Gaps and inconsistencies between documented vision and actual codebase reality.

---

## ~~Critical: Two Competing Permission Models~~ (RESOLVED)

The codebase contained two structurally incompatible permission models:

**Model A** (used by `@bands/format`, `band.schema.json`, `docs/band-format.md`, actual skills like `github` and `slack`):
```yaml
allow:
  cli: ["python *"]
  read: ["./data/**"]
deny:
  cli: ["rm *"]
limit:
  maxRuntimeMs: 60000
```

**Model B** (was used by examples, `codemod` skill, wrapped-skills, `@bands/server` sandbox):
```yaml
capabilities:
  tools:
    default: deny
    allow: [...]
  filesystem:
    default: deny
    allow: [...]
  network:
    egress:
      default: deny
      allow_dns: [...]
```

**Resolved:**
- All 10 `wrapped-skills/` files converted from Model B → Model A
- All `examples/` files converted from Model B → Model A
- `skills/codemod/BAND.md` converted from Model B → Model A
- `packages/runtime/src/loader.ts` (`compileBand()`) now reads Model A (`band.allow?.net`)
- `packages/runtime/src/skills/generator.ts` now outputs Model A (`allow.tools`, `allow.read`, `allow.write`, `allow.net`, `limit`)

**Remaining:** None. All code now uses Model A.

---

## ~~Critical: `limit` vs `limits` (Singular vs Plural)~~ (RESOLVED)

Standardized on `limit` (singular) everywhere: examples, skills, wrapped-skills, test fixtures, the runtime loader, and `@bands/server` (app.ts).

---

## ~~Critical: Execution Target Naming Inconsistency~~ (RESOLVED)

Standardized on `local-lima` everywhere: types, schema, constants, CLI, skills, docs, and tests.

---

## ~~High: Future Features Used in Current Examples~~ (RESOLVED)

Converted all examples and the codemod skill to use only current schema fields:
- `schemas` → `contract` (with URL refs)
- `returns` → removed (future feature per `docs/FUTURE.md`)
- `capabilities` → flattened into `allow`/`deny`/`insist` (Model A)
- `capabilities.filesystem` → `allow.read`/`allow.write`/`deny.read`/`deny.write`
- `capabilities.network.egress.allow_dns` → `allow.net`

All 5 files now validate against `band.schema.json` and parse correctly with `@bands/format`.

---

## ~~High: `version` Field Missing from Schema~~ (RESOLVED)

Added `version` (positive integer) to `band.schema.json`, `BandDocument` type, `ALLOWED_TOP_LEVEL_KEYS`, `CANONICAL_KEY_ORDER`, the parser's `buildDocument()`, and the validator. The field is now parsed, validated, round-tripped, and available to downstream consumers like `@bands/server`.

---

## ~~High: Server Route Mismatch~~ (RESOLVED)

All three documentation files (`docs/server-protocol.md`, `packages/server/README.md`, `README.md`) previously documented a stateless `POST /execute` endpoint that doesn't exist. The actual API is stateful: `POST /init` loads a band, then `POST /` executes payloads against it. Updated all docs to match the actual routes (`GET /health`, `POST /init`, `POST /`, `GET /band`) with correct request/response shapes and error codes.

---

## ~~Medium: `docs/band-format.md` Underdocuments the Schema~~ (RESOLVED)

`docs/band-format.md` previously only documented `band`, `icon`, `description`, `version`, `allow`, `deny`, `insist`, `limit`, and `execution`. The schema defines many more fields.

**Resolved:** Added documentation for all undocumented schema fields: `url`, `path`, `extends`, `includes`, `env`, `provides`, `requires`, `contract`, and band-specific config (`bandConfig`).

---

## ~~Medium: `description` Required Mismatch~~ (RESOLVED)

- `band.schema.json` lists `description` in the `required` array alongside `band` and `icon`
- `docs/band-format.md` previously listed `description` under "Optional Fields"

**Resolved:** Made `description` truly required everywhere — validator now errors (not warns) on missing required fields, docs updated to list `description` as required, all tests updated.

---

## ~~Medium: Undocumented Limit Fields in Examples~~ (RESOLVED)

Removed `maxAsyncDurationMs` and `maxStreamItems` from `examples/full.band.md` and `packages/format/test/fixtures/full.band.md`. Both now use only limit fields defined in `schemas/defs/limits.json`: `maxInputBytes`, `maxOutputBytes`, `maxRuntimeMs`, `maxCostDollars`.

---

## ~~Medium: No Server Package Tests~~ (RESOLVED)

`packages/server/test/sandbox.test.ts` now covers `canUseTool`, `canAccessPath`, `canAccessNetwork`, `canRunCli`, `execute` timeout, and app.ts input/output limit enforcement (30 tests).

---

## ~~Medium: `docs/band-format.md` Lists Wrong Required Fields~~ (RESOLVED)

The doc previously said only `band` and `icon` are required, but the schema requires three fields: `band`, `icon`, `description`.

**Resolved:** Updated `docs/band-format.md` to list `description` as a required field and updated the validation section to include `description` in the required fields list.

---

## ~~Low: Undocumented Format Package Exports~~ (RESOLVED)

`packages/format/src/index.ts` exports `normalize` (from `./normalize`) which was not mentioned in `packages/format/README.md`.

**Resolved:** Added `normalize` to the format package README.

---

## ~~Low: Undocumented Runtime Package Exports~~ (RESOLVED)

`packages/runtime/src/index.ts` exports `ErrorCodes` (from `./types`) which was not mentioned in `packages/runtime/README.md`.

**Resolved:** Added `ErrorCodes` to the runtime package README.

---

## ~~Low: Slack Skill Uses Non-Schema Fields~~ (RESOLVED)

`skills/slack/BAND.md` includes a `slack` top-level key with channel permissions. This was flagged as unsupported, but it is actually working as designed:

- `band.schema.json` has `additionalProperties: true`, so extra keys are valid
- The validator exempts band-namespaced keys from unknown-key warnings (`validate.ts`)
- The parser extracts `raw[bandName]` into the `bandConfig` field
- `BandDocument` has `bandConfig?: Record<string, unknown>` for this purpose

**Resolved:** This is the intended `bandConfig` mechanism, now documented in `docs/band-format.md`.

---

## ~~Low: `@bands/bands` Package is Empty~~ (RESOLVED)

The README and JSDoc described a fully populated package with subdirectories, scripts, references, and assets that didn't exist.

**Resolved:** Trimmed README and JSDoc to accurately describe the package as a placeholder with a `BANDS_DIR` export.

---

## Summary Table

| Severity | Issue | Files Affected |
|---|---|---|
| ~~Critical~~ | ~~Two incompatible permission models~~ (RESOLVED — all code uses Model A) | server/sandbox.ts |
| ~~Critical~~ | ~~`limit` vs `limits` singular/plural mismatch~~ (RESOLVED — standardized on `limit`) | schema, examples, server, codemod |
| ~~Critical~~ | ~~Execution target naming~~ (RESOLVED — standardized on `local-lima`) | types.ts, constants.ts, cli.ts, codemod BAND.md |
| ~~High~~ | ~~Future features used in current examples~~ (RESOLVED — converted to current schema fields) | examples/*.band.md, codemod BAND.md, FUTURE.md |
| ~~High~~ | ~~`version` field used but not in schema/types~~ (RESOLVED — added to schema, types, parser, validator) | examples, codemod, server app.ts |
| ~~High~~ | ~~Server route `POST /execute` documented but actual is `POST /`~~ (RESOLVED — docs updated to match actual routes) | server README, server-protocol.md, README.md |
| ~~Medium~~ | ~~band-format.md omits half the schema fields~~ (RESOLVED — all schema fields documented) | band-format.md, band.schema.json |
| ~~Medium~~ | ~~`description` required in schema, optional in docs~~ (RESOLVED — `description` now required everywhere) | band-format.md, validate.ts |
| ~~Medium~~ | ~~Undocumented limit fields in examples~~ (RESOLVED — removed non-schema limit fields) | full.band.md, limits.json |
| ~~Medium~~ | ~~No server package tests~~ (RESOLVED — 30 tests in sandbox.test.ts) | server/test/ |
| ~~Low~~ | ~~Undocumented exports (normalize, ErrorCodes)~~ (RESOLVED — added to READMEs) | format/index.ts, runtime/index.ts |
| ~~Low~~ | ~~Slack skill uses non-schema top-level key~~ (RESOLVED — working as designed via bandConfig) | slack/BAND.md |
| ~~Low~~ | ~~@bands/bands package is empty placeholder~~ (RESOLVED — README trimmed to match reality) | bands/index.ts, bands/README.md |
