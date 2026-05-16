# Banded Skills

A banded skill packages agent capabilities as sandboxed, script-based units. Each script runs inside a banded microVM with maximal permission restriction.


## Directory Structure

```
my-skill/
├── SKILL.md                              # Skill metadata and instructions
├── BAND.md                               # Top-level band (or url:/path: reference)
└── scripts/
    ├── summarize-pull-request            # Wrapper script
    ├── analyze-code                      # Wrapper script
    ├── BAND.md                           # (optional) default band for all scripts
    └── resources/
        ├── summarize-pull-request/
        │   ├── run.sh                    # Implementation (runs in sandbox)
        │   ├── BAND.md                   # (optional) per-script band override
        │   ├── input_schema.json
        │   └── output_schema.json
        └── analyze-code/
            ├── run.sh
            ├── input_schema.json
            └── output_schema.json
```


## Band Discovery

Most-specific wins. No composition between levels.

1. `scripts/resources/<name>/BAND.md` — per-script (highest priority)
2. `scripts/BAND.md` — default for all scripts
3. `BAND.md` — top-level fallback


## Reference BANDs

A BAND.md can delegate via `url` or `path`:

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

URL references resolved via `parseGitHubUrl()`. Path references resolve relative to the BAND.md file.


## Wrapper Scripts

Each wrapper resolves its own path and invokes the CLI:

```bash
#!/bin/bash
DIR="$(cd -P "$(dirname "$0")" && pwd)"
ROOT="$(cd -P "$DIR/../../.." && pwd)"
SKILL_ROOT="$(cd -P "$DIR/.." && pwd)"
bun "$ROOT/packages/runtime/src/cli.ts" exec "$DIR/resources/<name>" --skill_root "$SKILL_ROOT" "$@"
```


## Schema Files

`input_schema.json` and `output_schema.json` are standard JSON Schema. Dual purpose: validation before/after execution, and `--help` documentation.


## I/O Protocol

Scripts receive paths via environment variables:

| Variable | Purpose |
|----------|---------|
| `$INPUT_PATH` | JSON file with input data |
| `$OUTPUT_PATH` | Where to write JSON output |


## Execution Targets

The discovered BAND.md determines where scripts run.

| Target | Isolation | Enforcement |
|--------|-----------|-------------|
| `lima` | Full Linux VM | File-based I/O via `limactl` |
| `cloudflare` | V8 isolates | Placeholder |

For `lima`, `band exec` uses file-based execution: `limactl copy` staging dir in, `limactl shell` runs `run.sh`, `limactl copy` output back.


## CLI Commands

```bash
band validate-skill <dir>                        # Validate structure
band exec <resource-dir> [--key=value ...]        # Execute a script
band convert-skill <source> --output <dir>        # Convert to banded format
```


## Creating a Banded Skill

### 1. Define SKILL.md

```yaml
---
name: my-tool
description: Does useful things
---

# my-tool

Available scripts:
- `process-data` — Processes input data
```

### 2. Create BAND.md

```yaml
---
band: my-tool
icon: 🔧
description: Sandboxed tool execution
allow:
  cli:
    - "echo *"
execution:
  target: lima
---
```

### 3. Create scripts

For each capability:

- `scripts/<name>` — wrapper script
- `scripts/resources/<name>/run.sh` — implementation
- `scripts/resources/<name>/input_schema.json`
- `scripts/resources/<name>/output_schema.json`

### 4. Per-script bands (optional)

For scripts needing different permissions:

```yaml
---
band: process-data
icon: 📊
description: Restricted data processing
allow:
  cli:
    - "python3 *"
    - "jq *"
execution:
  target: lima
---
```

### 5. Validate

```bash
band validate-skill ./my-tool
```


## Permission Model

Deny by default. Deny > Insist > Allow.

| Section | Purpose |
|---------|---------|
| `allow` | What the script can do |
| `deny` | Explicitly blocked (overrides allow) |
| `insist` | Parent requires child to also allow |

All patterns use glob syntax. See [band-format.md](band-format.md).


## Binary Build

```bash
cd packages/runtime
bun run build:bin
```

Produces a `band` binary for PATH. Wrappers can fall back to `bunx @bands/runtime exec`.
