# CLI Reference

```bash
bun run band <command> [options]
```

Or if installed as a binary: `band-cli <command> [options]`.


## Commands


### `run`

Execute a band.

```bash
band run <band.md> [options]
```

| Option | Description |
|--------|-------------|
| `--target <target>` | Execution target: `lima`, `cloudflare` |
| `--input <json>` | JSON payload string |
| `--input-file <file>` | Read payload from JSON file |
| `--verbose` | Verbose logging |

```bash
band run my-band.md --target lima --input-file payload.json
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
| `--dry-run` | Show plan without deploying |


### `init`

Initialize a Cloudflare Worker with a band configuration.

```bash
band init <worker-url> <band.md>
```


### `validate`

Validate a band file. Checks YAML syntax, required fields, permission patterns, limit values. Exits non-zero on failure.

```bash
band validate <band.md>
```


### `targets`

List available execution targets and their status.

```bash
band targets
```

---


## Skill Commands


### `wrap-skill`

Generate a `.band.md` from a skill directory or GitHub URL.

```bash
band wrap-skill <source> [--output <file>]
```

```bash
band wrap-skill ./skills/github --output github.band.md
band wrap-skill https://github.com/org/skill-repo --output skill.band.md
```


### `run-skill`

Execute a skill locally.

```bash
band run-skill <source> [--request <text>]
```


### `validate-skill`

Validate a banded skill directory. Checks SKILL.md, BAND.md, script resources, schemas.

```bash
band validate-skill <skill-dir>
```


### `convert-skill`

Convert an Agent Skills directory to banded format.

```bash
band convert-skill <source> --output <dir> [--dry-run] [--verbose]
```

| Option | Description |
|--------|-------------|
| `--output <dir>` | Output directory (required unless `--dry-run`) |
| `--dry-run` | Show what would be created |
| `--verbose` | Verbose logging |

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
| `--skill_root=<dir>` | Skill root for band discovery |
| `--help` | Show script schema |

```bash
band exec skills/github/scripts/resources/gist-list --limit=5
band exec skills/github/scripts/resources/pr-create --help
```

CLI string arguments are coerced to match `input_schema.json` types (`--limit=5` becomes integer `5`).

---


## VM Management


### `setup`

Create and provision the Lima VM.

```bash
band setup [--force]
```

Installs Bun, copies the server, starts it on port 9000. `--force` recreates if VM exists.


### `teardown`

Stop and delete the Lima VM.

```bash
band teardown
```

---


## Locked-Down Runner

The `band` binary (built from `band-run.ts`) is a locked-down entrypoint for agent sessions.

```bash
band <script-name> [--key=value ...]
band --list
band <script-name> --help
```

Discovers scripts from `BAND_SKILLS_DIR` (default: `~/.claude/skills`). Only runs registered scripts. Forces Lima VM execution.

| Variable | Default | Description |
|----------|---------|-------------|
| `BAND_SKILLS_DIR` | `~/.claude/skills` | Directory to scan for skills |

### Installation

```bash
bun run install:band   # Compiles to /usr/local/bin/band
```
