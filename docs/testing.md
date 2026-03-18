# Testing

## Test Types

| Type | What it tests | Command |
|------|---------------|---------|
| Unit | Format parsing, validation, schemas | `bun run test:format` |
| Editor | Web editor components | `bun run test:editor` |
| Runtime unit | Band execution, discovery, CLI parsing | `bun run test:unit` |
| Executor | Execution targets (local, lima) | `bun run test:runtime` |
| Integration | Cross-component workflows | `bun run test:integration` |
| Skill direct | Scripts execute correctly | `bun run test:skills:direct <skill>` |
| Skill agent | AI agent selects correct scripts | `bun run test:skills:agent <skill>` |

## Running Tests

```bash
# Everything
bun test

# By package
bun run test:format
bun run test:editor
bun run test:runtime

# Runtime subsets
bun run test:unit
bun run test:integration
bun run test:all          # unit + executor + integration

# Skill tests
bun run test:skills github           # all tests for github skill
bun run test:skills:direct github    # direct tests only
bun run test:skills:agent github     # agent tests only
```

## Required Environment

### Package tests (no env needed)

```bash
bun run test:format    # Pure parsing/validation, no external deps
bun run test:editor    # Web component tests
bun run test:unit      # Runtime unit tests with fixtures
```

### Skill direct tests

```bash
# In .env or packages/runtime/.env
TEST_GITHUB_TOKEN=ghp_...          # GitHub PAT with repo scope
TEST_GITHUB_REPO=owner/repo        # A test repository you own
TEST_GIST_GITHUB_TOKEN=ghp_...     # Classic PAT with gist scope
```

### Skill agent tests

All of the above plus:

```bash
ANTHROPIC_API_KEY=sk-ant-...       # Anthropic API key
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # Optional model override
```

## Writing Skill Tests

### Direct Tests

Direct tests call scripts via `bandExec()` and verify inputs/outputs.

File naming: `skills/<name>/test/github-skill-*.test.ts`

```typescript
import { describe, expect, test } from "bun:test";
import { gh, TIMEOUT } from "./github-helpers";

describe("my feature", () => {
  test("does the thing", async () => {
    const result = await gh("my-script", {
      param1: "value1",
      param2: 42,
    });

    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.field).toBe("expected");
  }, TIMEOUT);
});
```

The test helper (`gh()` in github tests) wraps `bandExec()`:

```typescript
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";

async function gh(script: string, input: Record<string, unknown>) {
  const tempDir = mkdtempSync(join(tmpdir(), "test-"));
  const inputPath = join(tempDir, "input.json");
  writeFileSync(inputPath, JSON.stringify(input));

  try {
    return await bandExec({
      resourceDir: join(RESOURCES, script),
      args: {},
      inputPath,
      skillRoot: SKILL_ROOT,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
```

### Agent Tests

Agent tests verify that an AI model correctly selects the right script for a natural language prompt.

File naming: `skills/<name>/test/agent-*.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { createAgentHarness, AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";

const { agentCall, execScript } = await createAgentHarness({
  skillDir: resolve(__dirname, ".."),
  requiredEnv: ["TEST_GITHUB_TOKEN"],
  envToSet: { GITHUB_TOKEN: process.env.TEST_GITHUB_TOKEN! },
});

describe("agent: my feature", () => {
  test("selects correct script", async () => {
    const result = await agentCall("List open issues in owner/repo");

    expect(result.toolName).toBe("issue-list");
    expect(result.toolInput.repo).toBe("owner/repo");
    expect(result.toolInput.state).toBe("open");
    expect(result.execResult.success).toBe(true);
  }, AGENT_TIMEOUT);
});
```

**How `createAgentHarness` works:**

1. Loads SKILL.md as a system prompt
2. Reads `input_schema.json` from each script to build tool definitions
3. Sends the prompt to Claude with `tool_choice: { type: "any" }`
4. Returns which tool was selected and what input was generated
5. Executes the script with `bandExec()` and returns the result

### Test Patterns

**Lifecycle tests** — Create, verify, modify, delete:

```typescript
let resourceId: string;

test("create", async () => {
  const result = await gh("create", { name: "test" });
  resourceId = (result.data as any).id;
  expect(resourceId).toBeTruthy();
});

test("view", async () => {
  const result = await gh("view", { id: resourceId });
  expect((result.data as any).name).toBe("test");
});

test("delete", async () => {
  const result = await gh("delete", { id: resourceId });
  expect((result.data as any).deleted).toBe(true);
});
```

**Cleanup with afterAll:**

```typescript
afterAll(async () => {
  if (resourceId) {
    try { await gh("delete", { id: resourceId }); } catch {}
  }
});
```

## Test Fixtures

Runtime unit tests use fixtures at `packages/runtime/test/fixtures/`:

```
test/fixtures/
├── valid-skill/           # Valid skill with SKILL.md, BAND.md, scripts
├── invalid-skill/         # Intentionally broken for error testing
└── ...
```

## CI Pipeline

The CI runs three jobs:

1. **unit-tests** — Format, editor, runtime tests (no external deps)
2. **skill-tests-direct** — Script execution tests (requires GitHub tokens, Lima VM)
3. **skill-tests-agent** — Agent selection tests (requires Anthropic API key)

Agent tests run after unit tests pass. Both skill test jobs run in Lima VMs with KVM acceleration.

Required GitHub secrets:
- `TEST_GITHUB_TOKEN`
- `TEST_GITHUB_REPO`
- `TEST_GIST_GITHUB_TOKEN`
- `ANTHROPIC_API_KEY`

## Rules

From CLAUDE.md:
- **Never skip tests.** No `describe.skipIf`, no `test.skipIf`, no conditional skipping. If required env vars are missing, let the test error.
- **Never use fallbacks unless requested.** Tests should fail clearly, not silently succeed with degraded behavior.
