# Creating Skills

A banded skill is a directory containing instructions, permissions, and executable scripts that an AI agent can use.

## Skill Structure

```
my-skill/
├── SKILL.md                        # Agent instructions + metadata
├── BAND.md                         # Permissions and execution config
└── scripts/
    ├── my-script                   # Wrapper script (called by agent)
    └── resources/
        └── my-script/
            ├── run.sh              # Execution script
            ├── input_schema.json   # Input parameters
            └── output_schema.json  # Output format
```

## Step 1: Create SKILL.md

The SKILL.md contains metadata (frontmatter) and instructions (body) for the agent.

```markdown
---
name: my-skill
description: Does something useful when the user asks for X
---

# My Skill

Description of what this skill does.

## Available scripts

- **`do-something`** — Does the thing. Input: `param1`, `param2`
- **`check-status`** — Checks status. Input: `id`
```

**Frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Lowercase, hyphens only, 1-64 chars. Must match directory name. |
| `description` | Yes | When to use this skill. Max 1024 chars. |
| `allowed-tools` | No | Pre-approved tools (e.g., `Bash(band *)`) |
| `license` | No | License identifier |
| `compatibility` | No | Environment requirements |
| `metadata` | No | Arbitrary key-value pairs |

## Step 2: Create BAND.md

The BAND.md defines what the scripts are allowed to do inside the sandbox.

```yaml
---
band: my-skill
icon: 🔧
description: My skill permissions

allow:
  cli:
    - "my-tool *"
    - "jq *"

env:
  secrets:
    - MY_API_TOKEN

requires:
  secrets:
    - MY_API_TOKEN

execution:
  target: local-lima
---
```

**Key sections:**

| Section | Description |
|---------|-------------|
| `allow.cli` | Shell commands the scripts may run |
| `allow.read` | Files the scripts may read |
| `allow.write` | Files the scripts may write |
| `allow.net` | Network destinations the scripts may reach |
| `deny.*` | Explicit denials (override allow) |
| `env.secrets` | Environment variables passed into sandbox |
| `requires.secrets` | Secrets that must be set (fails fast if missing) |
| `execution.target` | Where to run: `local-dangerously`, `lima`, `cloudflare` |

### Band Discovery

Bands are resolved from most-specific to least-specific:

1. `scripts/resources/<name>/BAND.md` — per-script override
2. `scripts/BAND.md` — default for all scripts
3. `BAND.md` — skill-wide default

## Step 3: Create a Script

### 3a. Input Schema

Define parameters in `scripts/resources/my-script/input_schema.json`:

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The name to greet"
    },
    "count": {
      "type": "integer",
      "description": "How many times to greet",
      "default": 1
    }
  },
  "required": ["name"]
}
```

Supported types: `string`, `integer`, `number`, `boolean`, `array`, `object`.

### 3b. Output Schema

Define the output format in `scripts/resources/my-script/output_schema.json`:

```json
{
  "type": "object",
  "properties": {
    "greeting": {
      "type": "string",
      "description": "The greeting message"
    }
  }
}
```

### 3c. Execution Script

Write the logic in `scripts/resources/my-script/run.sh`:

```bash
#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

NAME=$(echo "$INPUT" | jq -r '.name')
COUNT=$(echo "$INPUT" | jq -r '.count // 1')

# Do the work
GREETING="Hello, $NAME! (x$COUNT)"

# Write JSON output
echo "{\"greeting\": $(echo "$GREETING" | jq -Rs .)}" > "${OUTPUT_PATH:-/dev/stdout}"
```

**Conventions:**
- Read input from `$INPUT_PATH` (JSON file)
- Write JSON output to `$OUTPUT_PATH` (or stdout if unset)
- Use `jq` for JSON parsing and construction
- Exit non-zero on failure with error message on stderr
- Keep scripts idempotent when possible

### 3d. Wrapper Script

Create `scripts/my-script` (the agent-facing entrypoint):

```bash
#!/bin/bash
DIR="$(cd -P "$(dirname "$0")" && pwd)"
ROOT="$(cd -P "$DIR/../../.." && pwd)"
SKILL_ROOT="$(cd -P "$DIR/.." && pwd)"
bun "$ROOT/packages/runtime/src/cli.ts" exec "$DIR/resources/my-script" --skill_root "$SKILL_ROOT" "$@"
```

Make it executable:

```bash
chmod +x scripts/my-script
```

The wrapper resolves symlinks (via `cd -P`) so the skill works when symlinked into `~/.claude/skills/`.

## Step 4: Validate

```bash
bun run band validate-skill skills/my-skill
```

This checks:
- SKILL.md exists with `name` and `description`
- BAND.md exists (at any level in the discovery chain)
- Every wrapper in `scripts/` has a matching `scripts/resources/<name>/` directory
- Every resource directory has a `run.sh`
- All `input_schema.json` and `output_schema.json` files are valid JSON

## Step 5: Test

### Direct Tests

Test scripts by calling them directly:

```typescript
import { bandExec } from "../../../packages/runtime/src/banded-skills/exec";

const result = await bandExec({
  resourceDir: join(SKILL_ROOT, "scripts/resources/my-script"),
  args: { name: "World" },
  skillRoot: SKILL_ROOT,
});

expect(result.success).toBe(true);
expect((result.data as any).greeting).toContain("World");
```

### Agent Tests

Test that an AI agent correctly selects and uses scripts:

```typescript
import { createAgentHarness } from "../../../scripts/agent-test-helpers";

const { agentCall } = await createAgentHarness({
  skillDir: resolve(__dirname, ".."),
  requiredEnv: ["MY_API_TOKEN"],
  envToSet: { MY_API_TOKEN: process.env.MY_API_TOKEN! },
});

const result = await agentCall("Greet the user named Alice");
expect(result.toolName).toBe("my-script");
expect(result.toolInput.name).toBe("Alice");
```

See [Testing](testing.md) for more detail.

## Step 6: Install

Symlink the skill into `~/.claude/skills/`:

```bash
mkdir -p ~/.claude/skills
ln -s /path/to/my-skill ~/.claude/skills/my-skill
```

The `band` runner and Claude Code's skill system will discover it automatically.

## Complete Example

The `skills/example-banded/` directory contains a minimal working skill with one script (`echo-input`). The `skills/github/` directory demonstrates a full-featured skill with 30+ scripts.
