# Bands

> Pre-alpha. 0.1.0-berry. [Lobster life-cycle versioning.](VERSIONING.md)

Sandboxed execution for AI agent skills. Deny by default.

Skills are functions. Bands are their closures. Every skill declares what it needs — network hosts, CLI commands, file paths, secrets. Everything else is denied at the kernel level.

## Isolation

Scripts run inside a Lima VM with five enforcement layers.

| Layer | Mechanism |
|-------|-----------|
| VM boundary | Full Linux kernel via KVM / Virtualization.framework |
| Network | Per-execution iptables chains, UID-owner matched |
| Filesystem | Bubblewrap mount namespace, deny patterns excluded |
| CLI | PATH-only wrapper directory, argument pattern matching |
| User | Unprivileged `band-runner` via sudo |

A script that declares `allow.net: ["api.github.com"]` can reach GitHub and nothing else. A script that declares `allow.cli: ["gh *", "jq *"]` can run those two commands and nothing else. Undeclared paths do not exist inside the sandbox. Secrets are scoped to the workdir and cleaned after every execution.

## How it works

A band is a YAML frontmatter block in a Markdown file. A skill is a directory with a band, scripts, and schemas.

```yaml
# BAND.md
---
band: example
allow:
  cli: ["curl *", "jq *"]
  net: ["api.example.com"]
  read: ["./data/**"]
  write: ["./output/**"]
env:
  secrets: [API_KEY]
execution:
  target: local-lima
---
```

The agent sees simple CLI commands. The runtime enforces everything else.

1. Validate input against the script's JSON Schema
2. Send script + input + rules to the band server in the VM
3. Set up per-execution iptables firewall
4. Create bubblewrap sandbox with mount namespace
5. Create CLI wrappers — only declared commands exist in PATH
6. Run script as `band-runner` inside the sandbox
7. Validate output against the output schema
8. Tear down firewall, clean workdir, return output

## Permission model

`insist` is the preferred pragma -- use this for anything that you know must run (or else it's an error).

`allow` sparingly, for anything that may be used but is optional. 

`deny` merely pokes holes in allow, since everything is denied by default.

```yaml
allow:
  cli: ["gh *", "jq *"]
  net: ["api.github.com"]
  read: ["./data/**"]
  write: ["./output/**"]

deny:
  cli: ["rm -rf *"]
  read: ["./data/secrets/**"]

insist:
  cli: ["gh issue create *"]
```

Deny punches holes in allow. Insist forces the skill to use a capability — the run fails if the pattern is never satisfied. Anything not in allow is denied.

## Contracts

Every script has typed input and output defined by JSON Schema. The runtime validates both boundaries. No untyped data crosses the sandbox.

```
skills/github/
├── schemas/
│   ├── input/        # One schema per script
│   ├── output/       # Return type per script
│   └── defs/         # Shared types ($ref)
├── scripts/          # Executable scripts with run.sh
├── BAND.md           # Permissions and execution target
└── SKILL.md          # Instructions for the agent
```

## Skills

| Skill | Scripts | Description |
|-------|---------|-------------|
| github | 32 | Issues, PRs, releases, labels, gists, search, raw API |
| slack | 11 | Messages, channels, threads, reactions, files |
| elevenlabs | 6 | Text-to-speech, voices, sound effects |
| summarize | 2 | Document summarization via Claude Code CLI |

## Setup

```bash
bun install
bun test
```

Lima VM (recommended):

```bash
brew install lima
bun run band setup
```

## What works

- Network egress enforcement (iptables, kernel-level)
- Filesystem isolation (bubblewrap mount namespace)
- CLI allow/deny with argument pattern matching
- File deny patterns enforced in mount namespace
- User privilege separation
- Insist enforcement
- Secrets isolation and cleanup
- Contract schema validation (Ajv, `$ref` resolution)

## What doesn't work yet

- `maxInputBytes` / `maxOutputBytes` (parsed, not enforced)
- `maxCostDollars` (parsed, not enforced)
- Cloudflare Workers executor (code exists, not production-tested)
- seccomp profiles

## License

MIT
