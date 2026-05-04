# CLI Reference

The `band` CLI manages band execution, skill operations, and VM lifecycle.

```bash
bun run band <command> [options]
```

Or if installed as a binary: `band-cli <command> [options]`.

## Commands

### `run`

Execute a band with a specified target.

```bash
band run <band.md> [options]
```

| Option | Description |
|--------|-------------|
| `--target <target>` | Execution target: `lima`, `cloudflare` |
| `--input <json>` | JSON payload string |
| `--input-file <file>` | Read payload from JSON file |
| `--verbose` | Enable verbose logging |

```bash
# Local execution
band run examples/minimal.band.md --input '{"message": "hello"}'

# Run in Lima VM
band run my-band.md --target lima --input-file payload.json

# Deploy and run on Cloudflare
band run my-band.md --target cloudflare --input '{"data": [1,2,3]}'
```

### `deploy`

Deploy a band as a Cloudflare Worker.

```bash
band deploy <band.md> [--name <name>] [--dry-run]
```

| Option | Description |
|--------|-------------|
| `--name <name>` | Worker name (default: derived from band name) |
| `--dry-run` | Show deployment plan without deploying |

### `init`

Initialize an existing Cloudflare Worker with a band configuration.

```bash
band init <worker-url> <band.md>
```

### `validate`

Validate a band file.

```bash
band validate <band.md>
```

Checks YAML syntax, required fields, permission patterns, and limit values. Exits non-zero if validation fails.

### `targets`

List available execution targets and their status.

```bash
band targets
```

Shows whether each target (lima, cloudflare) is available and ready.

---

## Skill Commands

### `wrap-skill`

Generate a `.band.md` file from an Agent Skills directory or GitHub URL.

```bash
band wrap-skill <source> [--output <file>]
```

| Option | Description |
|--------|-------------|
| `--output <file>` | Write output to file (default: stdout) |

```bash
# From local directory
band wrap-skill ./skills/github --output github.band.md

# From GitHub
band wrap-skill https://github.com/org/skill-repo --output skill.band.md
```

### `run-skill`

Execute a skill locally.

```bash
band run-skill <source> [--request <text>]
```

| Option | Description |
|--------|-------------|
| `--request <text>` | Request text for the skill |

### `validate-skill`

Validate a banded skill directory structure.

```bash
band validate-skill <skill-dir>
```

Checks for required files (SKILL.md, BAND.md), validates frontmatter, and verifies script resources have `input_schema.json` and `run.sh`.

### `convert-skill`

Convert an Agent Skills directory into banded format.

```bash
band convert-skill <source> --output <dir> [--dry-run] [--verbose]
```

| Option | Description |
|--------|-------------|
| `--output <dir>` | Output directory (required unless `--dry-run`) |
| `--dry-run` | Show what would be created |
| `--verbose` | Enable verbose logging |

---

## Script Execution

### `exec`

Execute a banded script resource directly.

```bash
band exec <resource-dir> [--key=value ...] [options]
```

| Option | Description |
|--------|-------------|
| `--key=value` | Script parameters |
| `--input_path=<file>` | Read input from JSON file |
| `--output_path=<file>` | Write output to file |
| `--skill_root=<dir>` | Skill root directory for band discovery |
| `--help` | Show script schema |

```bash
# Run a script with parameters
band exec skills/github/scripts/resources/gist-list --limit=5

# With input file
band exec skills/github/scripts/resources/issue-view --input_path=input.json

# Show script parameters
band exec skills/github/scripts/resources/pr-create --help
```

CLI string arguments are automatically coerced to match the script's `input_schema.json` types (e.g., `--limit=5` becomes the integer `5`).

---

## VM Management

### `setup`

Create and provision the Lima VM for band execution.

```bash
band setup [--force]
```

| Option | Description |
|--------|-------------|
| `--force` | Force recreation if VM already exists |

Installs Bun, copies the server, and starts it on port 9000.

### `teardown`

Stop and delete the Lima VM.

```bash
band teardown
```

---

## Locked-Down Runner

The `band` binary (built from `band-run.ts` via `bun run install:band`) is a separate, locked-down entrypoint for agent sessions.

```bash
band <script-name> [--key=value ...]
band --list
band <script-name> --help
```

It discovers scripts from `BAND_SKILLS_DIR` (default: `~/.claude/skills`), only runs registered scripts, and forces Lima VM execution.

```bash
# List all available scripts
band --list

# Run a script
band gist-list --limit=5

# Show script parameters
band issue-create --help
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BAND_SKILLS_DIR` | `~/.claude/skills` | Directory to scan for skills |

### Installation

```bash
bun run install:band   # Compiles to /usr/local/bin/band
```
