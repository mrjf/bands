# Banded Skills

A **banded skill** packages agent capabilities as sandboxed, script-based units. Each script runs inside its own banded microVM with maximal permission restriction.

## Directory Structure

```
my-skill/
├── SKILL.md                              # Skill metadata and description
├── BAND.md                               # Top-level band (or url:/path: reference)
└── scripts/
    ├── summarize-pull-request            # Wrapper: band exec scripts/resources/summarize-pull-request "$@"
    ├── analyze-code                      # Wrapper: band exec scripts/resources/analyze-code "$@"
    ├── BAND.md                           # (optional) default band for all scripts
    └── resources/
        ├── summarize-pull-request/
        │   ├── run.sh                    # Implementation (runs in sandbox)
        │   ├── BAND.md                   # (optional) per-script band override
        │   ├── input_schema.json         # Input JSON Schema
        │   └── output_schema.json        # Output JSON Schema
        └── analyze-code/
            ├── run.sh
            ├── input_schema.json
            └── output_schema.json
```

## Key Concepts

### Band Discovery (Most-Specific Wins)

Each script gets its permissions from the most specific BAND.md found:

1. `scripts/resources/<name>/BAND.md` — per-script (highest priority)
2. `scripts/BAND.md` — default for all scripts
3. `BAND.md` — top-level fallback

No composition between levels. The most-specific band is used entirely.

### Reference BANDs

A BAND.md can delegate to another band via `url` or `path`:

```yaml
---
path: ../../shared/restricted.band.md
---
```

```yaml
---
url: https://github.com/org/bands/tree/main/templates/sandbox
---
```

URL references are resolved via `parseGitHubUrl()`. Path references resolve relative to the BAND.md file's directory.

### Wrapper Scripts

Each wrapper resolves its own path and invokes the CLI:

```bash
#!/bin/bash
DIR="$(cd -P "$(dirname "$0")" && pwd)"
ROOT="$(cd -P "$DIR/../../.." && pwd)"
SKILL_ROOT="$(cd -P "$DIR/.." && pwd)"
bun "$ROOT/packages/runtime/src/cli.ts" exec "$DIR/resources/<name>" --skill_root "$SKILL_ROOT" "$@"
```

### Schema Files

`input_schema.json` and `output_schema.json` are standard JSON Schema. They serve dual purposes:
- **Validation**: Input is validated before execution, output after
- **Documentation**: `--help` prints schema info without executing the script

### I/O Protocol

Scripts receive input/output paths via environment variables:
- `$INPUT_PATH` — JSON file with input data
- `$OUTPUT_PATH` — Where to write JSON output

## CLI Commands

### `band validate-skill <dir>`

Validate a banded skill directory structure:
- SKILL.md exists with name/description
- BAND.md exists and parses correctly
- scripts/ directory exists with wrappers
- Each wrapper has matching `scripts/resources/<name>/run.sh`
- Schema files are valid JSON
- Wrappers use `band exec` pattern

### `band exec <resource-dir> [options]`

Execute a banded script:

```bash
# With key-value args
band exec scripts/resources/echo-input --message="hello"

# With input/output files
band exec scripts/resources/echo-input --input_path=in.json --output_path=out.json

# Show help (reads schemas, no execution)
band exec scripts/resources/echo-input --help
```

### `band convert-skill <source> --output <dir>`

Convert an existing skill to banded format:

```bash
# Convert local skill
band convert-skill ./my-skill --output ./my-banded-skill --verbose

# Dry run (show what would be created)
band convert-skill ./my-skill --output ./out --dry-run
```

## Execution Targets

The discovered BAND.md determines where scripts run:

| Target | Isolation | Enforcement |
|--------|-----------|-------------|
| `local-dangerously` | None | Tracks only |
| `lima` | Full Linux VM | File-based I/O via `limactl` |
| `cloudflare` | V8 isolates | Full enforcement |

### Lima Execution

For `lima` targets, `band exec` uses file-based execution:
1. `limactl copy` staging dir into VM
2. `limactl shell` runs `run.sh` with `INPUT_PATH`/`OUTPUT_PATH`
3. `limactl copy` output back to host

This avoids needing the band-server HTTP endpoint for simple script execution.

## Creating a Banded Skill

### 1. Define the skill

Create `SKILL.md` with name and description:

```yaml
---
name: my-tool
description: Does useful things
---

# my-tool

Available scripts:
- `process-data` — Processes input data
```

### 2. Create the top-level BAND.md

```yaml
---
band: my-tool
icon: 🔧
description: Sandboxed tool execution
allow:
  cli:
    - "echo *"
execution:
  target: local-dangerously
---
```

### 3. Create scripts

For each capability, create:
- `scripts/<name>` — wrapper script
- `scripts/resources/<name>/run.sh` — implementation
- `scripts/resources/<name>/input_schema.json` — input schema
- `scripts/resources/<name>/output_schema.json` — output schema

### 4. (Optional) Add per-script bands

For scripts needing different permissions than the top-level band:

```yaml
---
band: process-data
icon: 📊
description: Restricted environment for data processing
allow:
  cli:
    - "python3 *"
    - "jq *"
execution:
  target: local-lima
---
```

### 5. Validate

```bash
band validate-skill ./my-tool
```

## Permission Model

Banded skills use deny-by-default permissions:
- `allow` — what the script can do
- `deny` — explicitly blocked (overrides allow)
- `insist` — parent requires child to also allow

All patterns use glob syntax. See the format package documentation for details.

## Binary Build

To compile the CLI to a standalone binary:

```bash
cd packages/runtime
bun run build:bin
```

This produces a `band` binary that can be placed on PATH. Wrappers can also fall back to `bunx @bands/runtime exec` if the binary isn't installed.
