# Testing

## Test Types

| Type | What it tests | Command |
|------|---------------|---------|
| Unit | Format parsing, validation, schemas | `bun run test:format` |
| Editor | Web editor components | `bun run test:editor` |
| Runtime unit | Band execution, discovery, CLI parsing | `bun run test:unit` |
| Executor | Execution targets (lima) | `bun run test:runtime` |
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
bun run test:all

# Skill tests
bun run test:skills github
bun run test:skills:direct github
bun run test:skills:agent github
```


## Environment

### Package tests (no env needed)

```bash
bun run test:format    # Pure parsing/validation
bun run test:editor    # Web components
bun run test:unit      # Runtime unit tests with fixtures
```

### Skill direct tests

```bash
TEST_GITHUB_TOKEN=ghp_...          # GitHub PAT with repo scope
TEST_GITHUB_REPO=owner/repo        # A test repository you own
TEST_GIST_GITHUB_TOKEN=ghp_...     # Classic PAT with gist scope
```

### Skill agent tests

All of the above, plus:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # optional
```


## Writing Skill Tests

### Direct Tests

Call scripts via `bandExec()`, verify inputs/outputs.

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

The test helper wraps `bandExec()`:

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

Verify that the model selects the right script for a natural language prompt.

File naming: `skills/<name>/test/agent-*.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { createAgentHarness, AGENT_TIMEOUT } from "../../../scripts/agent-test-helpers";

const { agentCall } = await createAgentHarness({
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

`createAgentHarness` loads SKILL.md as a system prompt, builds tool definitions from `input_schema.json`, sends the prompt to Claude with `tool_choice: { type: "any" }`, and returns which tool was selected plus the execution result.

### Lifecycle Pattern

Create, verify, modify, delete:

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

Cleanup with `afterAll`:

```typescript
afterAll(async () => {
  if (resourceId) {
    try { await gh("delete", { id: resourceId }); } catch {}
  }
});
```


## Fixtures

Runtime unit tests use fixtures at `packages/runtime/test/fixtures/`:

```
test/fixtures/
├── valid-skill/
├── invalid-skill/
└── ...
```


## CI

Three jobs:

1. unit-tests — Format, editor, runtime (no external deps)
2. skill-tests-direct — Script execution (requires GitHub tokens, Lima VM)
3. skill-tests-agent — Agent selection (requires Anthropic API key)

Agent tests run after unit tests pass. Both skill jobs run in Lima VMs with KVM acceleration.

Required secrets: `TEST_GITHUB_TOKEN`, `TEST_GITHUB_REPO`, `TEST_GIST_GITHUB_TOKEN`, `ANTHROPIC_API_KEY`.


## Rules

- Never skip tests. No `describe.skipIf`, no `test.skipIf`, no conditional skipping. Missing env vars should error, not skip.
- Never use fallbacks unless requested. Tests fail clearly, not silently.
