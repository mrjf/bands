# Bands

**Permission and isolation system for AI agent execution.**

Bands provides a declarative way to define what an AI agent can and cannot do, then enforces those permissions at runtime across multiple execution targets.

## What is a Band?

A **band** is a YAML configuration file (`.band.md`) that defines:

- **Identity**: Name, icon, description
- **Permissions**: What the agent is allowed/denied/required to do
- **Limits**: Resource constraints (time, bytes, cost)
- **Execution target**: Where to run (local, VM, edge)

```yaml
---
band: code-runner
icon: 🏃
description: Runs code in a sandboxed environment

allow:
  cli:
    - "node *"
    - "python *"
    - "echo *"
  read:
    - "./src/**"
    - "./package.json"
  write:
    - "./output/**"

deny:
  cli:
    - "rm *"
    - "sudo *"
  read:
    - "**/.env*"
    - "**/secrets/**"
  net:
    - "*.internal.corp"

limit:
  maxRuntimeMs: 30000
  maxOutputBytes: 10mb
---
```

## Execution Targets

Bands can run on three execution targets:

| Target | Isolation | Use Case |
|--------|-----------|----------|
| `local-dangerously` | None | Development, testing |
| `lima` | Full (Linux VM) | Production on macOS |
| `cloudflare` | Full (V8 isolates) | Production at edge |

All sandboxed targets (lima, cloudflare) **enforce** permissions - denied operations fail with `PERMISSION_DENIED`. The `local-dangerously` target only **reports** what would be allowed.

## Quick Start

```bash
# Install dependencies
bun install

# Run a band locally (no isolation)
bun run packages/runtime/src/cli.ts run ./examples/minimal.band.md \
  --input '{"message": "hello"}'

# Check available execution targets
bun run packages/runtime/src/cli.ts targets

# Run tests
bun test packages/runtime/test/integration/
```

## Project Structure

```
bands/
├── packages/
│   ├── format/          # Parse, validate, export BAND.md files
│   ├── runtime/         # Execute bands on different targets
│   ├── server/          # HTTP server for sandboxed execution
│   └── editor/          # Visual band editor (Web Components)
├── examples/            # Example band files
├── docs/                # Documentation
└── schemas/             # JSON schemas
```

## Packages

### @bands/format

Parse and validate BAND.md files:

```typescript
import { parseBandMd, exportBandMd } from "@bands/format";

const { document, errors } = parseBandMd(yamlContent);
const yaml = exportBandMd(document);
```

### @bands/runtime

Execute bands on different targets:

```typescript
import { executeBand } from "@bands/runtime";

const result = await executeBand(band, payload, {
  target: "lima",  // or "cloudflare", "local-dangerously"
});

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### @bands/server

HTTP server that enforces band permissions. Deployed to Lima VM or Cloudflare Workers.

```
POST /execute
  Body: { band: BandDocument, payload: any }
  Returns: { success: true, data: any } | { success: false, error: {...} }

GET /health
  Returns: { ready: true }
```

## Permission Model

Bands use a **deny-by-default** permission model:

1. If not in `allow`, it's denied
2. `deny` punches holes in `allow` (explicit denials)
3. `insist` requires operations to be performed (or execution fails)

### Permission Categories

| Category | Description | Example Patterns |
|----------|-------------|------------------|
| `cli` | Shell commands | `"node *"`, `"python scripts/*.py"` |
| `read` | File read access | `"./src/**"`, `"/tmp/**"` |
| `write` | File write access | `"./output/**"` |
| `net` | Network egress | `"api.github.com"`, `"*.npmjs.org"` |
| `tools` | MCP tools | GitHub URLs |
| `skills` | Agent skills | GitHub URLs |
| `mcps` | MCP servers | GitHub URLs |
| `apis` | API adapters | GitHub URLs |

### Glob Patterns

- `*` - matches any characters within a segment
- `**` - matches across segments (for paths)
- `?` - matches exactly one character

## Insist (Required Operations)

The `insist` section defines operations that **must** be performed:

```yaml
insist:
  cli:
    - "echo *"  # Must run at least one echo command
  read:
    - "/tmp/config.json"  # Must read this file
```

If insist requirements aren't satisfied, sandboxed executors return:
```json
{
  "success": false,
  "error": {
    "code": "INSIST_NOT_SATISFIED",
    "message": "Required operations not performed: cli:echo *"
  }
}
```

## Limits

```yaml
limit:
  maxInputBytes: 1mb      # Max request size
  maxOutputBytes: 10mb    # Max response size
  maxRuntimeMs: 30s       # Max execution time
  maxCostDollars: 1.00    # Max API cost
```

Supports human-readable units: `1kb`, `5mb`, `1gb`, `100ms`, `30s`, `5m`.

## Development

```bash
# Run all tests
bun test

# Run specific test suites
bun test packages/format/test/
bun test packages/runtime/test/executors/
bun test packages/runtime/test/integration/

# Type check
bun run typecheck
```

## Lima VM Setup (macOS)

```bash
# Install Lima
brew install lima

# Create the bands-executor VM
limactl create --name=bands-executor template://ubuntu

# Start the VM
limactl start bands-executor

# The runtime will automatically deploy the server to the VM
```

## Cloudflare Setup

```bash
# Install wrangler
bun add -g wrangler

# Login to Cloudflare
wrangler login

# Set environment variables
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Deploy a band
bun run packages/runtime/src/cli.ts run ./my-band.md --target cloudflare
```

## License

MIT
