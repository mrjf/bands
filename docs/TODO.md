# TODO — Runtime Stubs

Schema fields that are parsed and stored on `BandDocument` but not enforced at runtime. Each has a stub-documenting test that will break when enforcement is added.

## `env` (secrets/variables)

`getAllowedEnv()` always returns `{}`. No secrets are fetched from the environment or `.env` files, no variables are injected, no masking is performed.

- **Stub:** `packages/server/src/sandbox.ts` — `getAllowedEnv()` returns `{}`
- **Test:** `packages/server/test/env.test.ts`

## `contract` string ref resolution

Inline JSON Schema objects in `contract.input` / `contract.output` are validated at runtime (both inside the band server and outside in `executeBand()`). However, string references (file paths like `./schemas/input.json` or URLs like `https://example.com/schema.json`) are parsed and stored but silently skipped — no file is read, no URL is fetched, no validation occurs.

- **Stub:** `packages/server/src/app.ts` and `packages/runtime/src/executors/index.ts` — `typeof schema === "object"` guard skips strings
- **Test:** `packages/server/test/app.test.ts` — "skips contract enforcement for string schema refs"
- **Test:** `packages/runtime/test/executors/index.test.ts` — "skips contract enforcement for string schema refs"

## `limit.maxCostDollars`

Parsed and stored but never checked during execution. Bands with cost limits execute without restriction.

- **Stub:** `packages/server/src/app.ts` — no cost tracking or enforcement in `POST /`
- **Test:** `packages/server/test/app.test.ts` — "maxCostDollars is not enforced at runtime (stub)"

## Executor-level permission enforcement

Executors (`local-dangerously`, `local-lima`, `cloudflare`) echo input without enforcing `allow`/`deny` permissions at the execution level. The sandbox checks permissions via `canUseTool()`, `canAccessPath()`, etc., but executors don't call these checks during band execution.

- **Stub:** `packages/runtime/test/integration/executor-suite.ts` — permission suite disabled
- **Blocked on:** band-shell integration
