# Architecture

## Overview

Bands has two packages:

- **format** — parse, validate, and export BAND.md files
- **runtime** — execute bands on isolated targets

```
User / Agent
     │
     │  band.md + payload
     ▼
@bands/runtime
     │
     ├── lima executor ──→ Lima VM :9000 (band-server.ts)
     └── cloudflare     ──→ Cloudflare Worker (placeholder)
```

## Format

Pure library. No side effects.

```
packages/format/src/
├── parse.ts        # YAML frontmatter parsing
├── validate.ts     # Field and type validation
├── export.ts       # YAML serialization
├── glob.ts         # Permission pattern matching
├── effective.ts    # Compute effective policy from composition
├── conflicts.ts    # Detect permission conflicts
└── types.ts        # TypeScript interfaces
```

## Runtime

Orchestrates execution across targets.

```
packages/runtime/src/
├── cli.ts              # Command-line interface
├── band-server.ts      # Execution server (deployed inside VM)
├── executors/
│   ├── lima.ts         # Lima VM executor
│   └── cloudflare.ts   # Cloudflare Workers (placeholder)
└── banded-skills/      # Skill discovery and execution
```

## Band server

Single file deployed inside the Lima VM. Receives `POST /exec` with script, input, secrets, and permission rules.

1. Set up per-execution iptables firewall
2. Create bubblewrap sandbox (mount namespace, user separation)
3. Create CLI wrappers in isolated PATH
4. Run script as `band-runner`
5. Check insist rules against ops log
6. Tear down firewall, clean workdir, return output

Single-use mutex — rejects concurrent requests.

## Permission checking

```
deny takes precedence → check deny patterns first
then check allow patterns
default: denied
```

Insist verification runs after execution. The ops log records which commands were run, which files were accessed, and which hosts were contacted. Any unsatisfied insist pattern fails the run.

## Execution targets

| Target | Isolation | Status |
|--------|-----------|--------|
| lima | Full Linux VM, iptables, bubblewrap, user separation | Implemented |
| cloudflare | V8 isolates | Placeholder |
