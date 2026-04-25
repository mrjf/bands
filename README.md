# Bands

> **Pre-alpha. Experimental.** [0.1.0-berry](VERSIONING.md) — lobster life-stage versioning.

**Sandboxed execution for AI agent skills.**

Bands runs untrusted scripts inside isolated Linux VMs with kernel-level enforcement of network, filesystem, and CLI restrictions. Every skill declares what it needs. Everything else is denied.

## Security First

Scripts execute inside a Lima VM with multiple isolation layers:

| Layer | Mechanism | What it prevents |
|-------|-----------|------------------|
| **VM boundary** | Full Linux kernel (KVM / Virtualization.framework) | Host system access |
| **Network** | Per-execution iptables chains | Connections to undeclared hosts |
| **Filesystem** | Bubblewrap mount namespace | Reading files outside the workdir |
| **CLI** | PATH-only wrapper directory | Running undeclared commands |
| **User** | Unprivileged `band-runner` via sudo | Privilege escalation |
| **Secrets** | Workdir-scoped env vars, cleaned after execution | Secret leakage between executions |

Default deny. A script that declares `allow.net: ["api.github.com"]` can reach GitHub and nothing else. A script that declares `allow.cli: ["gh *", "jq *"]` can run `gh` and `jq` and nothing else. Everything not declared is blocked at the kernel level.

## How It Works

A **band** is a YAML config that declares permissions. A **skill** is a directory with a band config, scripts, and schemas.

```yaml
# skills/github/BAND.md
---
band: github
allow:
  cli:
    - "gh *"
    - "git *"
    - "jq *"
  net:
    - "*.github.com"
    - "*.githubusercontent.com"
env:
  secrets:
    - GITHUB_TOKEN
execution:
  target: local-lima
---
```

When a skill runs:

1. Host validates input against the script's JSON Schema
2. Host sends script + input + rules to the band server in the VM (`POST /exec`)
3. Server sets up per-execution iptables firewall (kernel-level network restriction)
4. Server creates bubblewrap sandbox (mount namespace, user separation)
5. Server creates CLI wrappers (only declared commands exist in PATH)
6. Script runs inside the sandbox as `band-runner`
7. Server validates output against the output schema
8. Server tears down firewall, cleans up workdir, returns output
9. Host writes back allowed output files (deny patterns enforced at copy boundary)

## Typed Contracts

Every script has a typed contract — JSON Schema for input and output. The runtime validates both before and after execution. No untyped data crosses the boundary.

```
skills/github/
├── schemas/
│   ├── input/           # One schema per script
│   │   ├── issue-create.json
│   │   ├── pr-list.json
│   │   └── ...
│   ├── output/          # Return type per script
│   │   ├── issue-create.json
│   │   └── ...
│   └── defs/            # Shared types ($ref)
│       ├── repo.json    # "owner/name" string
│       ├── limit.json   # integer, minimum: 1
│       └── ...
```

Input schemas define required fields, types, and descriptions. The runtime uses Ajv with `$ref` resolution and type coercion (CLI string args like `--limit=5` are coerced to integers).

```json
{
  "type": "object",
  "properties": {
    "repo": { "$ref": "repo.json" },
    "title": { "type": "string" },
    "labels": { "$ref": "labels-input.json" }
  },
  "required": ["repo", "title"]
}
```

Shared definitions in `schemas/defs/` are reusable across scripts — define `repo.json` once, `$ref` it everywhere. The type system catches invalid input before the script runs and invalid output before the caller receives it.

## Permission Model

**Default deny.** Every operation must be explicitly allowed.

```yaml
allow:
  cli: ["gh *", "jq *"]      # Only these commands exist
  net: ["api.github.com"]     # Only this host is reachable
  read: ["./data/**"]         # Only these files are copied in
  write: ["./output/**"]      # Only these files are copied back

deny:
  cli: ["rm -rf *"]           # Punch holes in allow (argument-level)
  net: ["evil.github.com"]    # Punch holes in allow wildcards
  read: ["./data/secrets/**"] # Excluded from copy-in
  write: ["./output/.env*"]   # Excluded from copy-back

insist:
  cli: ["gh issue-create *"]  # Must be executed or run fails
```

## Skills

Skills live in `skills/<name>/` with:

- **`BAND.md`** — Permissions, secrets, execution target
- **`SKILL.md`** — Instructions for the AI agent
- **`scripts/`** — Executable scripts with `run.sh` in each resource dir
- **`schemas/`** — JSON Schema for input/output validation

### Included skills

| Skill | Scripts | Description |
|-------|---------|-------------|
| `github` | 31 | Issues, PRs, releases, labels, gists, search, raw API |
| `slack` | 9 | Messages, channels, threads, reactions, files |
| `elevenlabs` | 5 | Text-to-speech, voices, sound effects |
| `summarize` | 1 | Summarize documents using Claude Code CLI |

## Project Structure

```
bands/
├── packages/
│   ├── format/          # Parse, validate, export BAND.md files
│   ├── runtime/         # Execute bands (Lima VM, band server)
│   └── editor/          # Visual band editor
├── skills/              # Banded skills (github, slack, elevenlabs)
├── docs/                # Architecture, TODO, future plans
├── SECURITY.md          # Threat model and enforcement status
├── VERSIONING.md        # Lobster Scale versioning
└── VERSION              # Current version (0.1.0-berry)
```

## Development

```bash
bun install

# Run all unit tests
bun test:all

# Run skill tests (needs API keys in .env)
bun test:skills

# Run specific skill tests
bun test:skills:direct    # Direct execution
bun test:skills:agent     # Agent mode (needs ANTHROPIC_API_KEY)
```

## Lima VM Setup

```bash
brew install lima
bun run band setup        # Creates VM, deploys band server, configures firewall
```

The setup creates a `bands-executor` VM with:
- Bun runtime
- iptables (network enforcement)
- bubblewrap (filesystem isolation)
- `band-runner` user (privilege separation)
- Band server v3.0 (systemd service on port 9000)
- Default iptables policy: REJECT all outbound from `band-runner`

## What's Implemented vs Planned

### Implemented and tested

- Network egress enforcement (iptables, kernel-level)
- Filesystem isolation (bubblewrap mount namespace)
- CLI allow/deny (PATH wrappers + argument pattern matching)
- File copy-in/copy-out with deny enforcement
- User privilege separation
- Insist enforcement (required operations)
- Secrets isolation
- Contract schema validation (inline + file path refs)
- Band server v3.0 (HTTP, single-use mutex, per-execution teardown)

### Parsed but not yet enforced

- `maxInputBytes` / `maxOutputBytes` (limits are compiled but not checked at execution time)
- `maxCostDollars` (for skills calling Claude API internally)

### Planned

- Cloudflare Workers executor (V8 isolates) — implementation exists, not production-tested
- `deny.read`/`deny.write` at OS level (currently enforced at copy boundary)
- seccomp profiles

See `docs/TODO.md` for details and `SECURITY.md` for the threat model.

## License

MIT
