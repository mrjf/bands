# Getting Started

## Prerequisites

- [Bun](https://bun.sh) v1.3+
- macOS or Linux
- Git

For Lima VM execution (optional):
- [Lima](https://lima-vm.io/) (`brew install lima` on macOS)

For Cloudflare execution (optional):
- Cloudflare account with Workers enabled
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`bun add -g wrangler`)

## Setup

```bash
git clone https://github.com/mrjf/bands.git
cd bands
bun install
```

Verify everything works:

```bash
bun test
```

This runs the format, editor, and runtime unit tests.

## Project Structure

```
bands/
├── packages/
│   ├── format/       # Parse, validate, export BAND.md files
│   ├── runtime/      # CLI, executors, skill system
│   ├── server/       # HTTP server enforcing permissions
│   ├── editor/       # Visual band editor (web UI)
│   └── bands/        # Curated band definitions
├── skills/           # Banded skills (e.g. github)
├── wrapped-skills/   # Pre-built skill bundles
├── examples/         # Example band files
├── docs/             # Documentation
├── schemas/          # JSON schemas for skill I/O
└── scripts/          # Build and test helpers
```

## Running a Band

```bash
# Run locally (no isolation)
bun run band run examples/minimal.band.md --input '{"message": "hello"}'

# Check available execution targets
bun run band targets
```

## Execution Targets

| Target | Isolation | Setup |
|--------|-----------|-------|
| `local-dangerously` | None (reports only) | None required |
| `lima` | Full Linux VM | `bun run band setup` |
| `cloudflare` | V8 isolate | Wrangler + Cloudflare account |

### Lima VM Setup

```bash
# Create and provision the VM (installs Bun, copies server)
bun run band setup

# Verify it's running
bun run band targets

# Run a band in the VM
bun run band run examples/minimal.band.md --target lima --input '{"message": "hello"}'

# Tear down the VM when done
bun run band teardown
```

### Cloudflare Setup

```bash
# Login to Cloudflare
wrangler login

# Set credentials
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Deploy and run
bun run band run examples/minimal.band.md --target cloudflare --input '{"message": "hello"}'
```

## Environment Variables

Create a `.env` file at the project root or `packages/runtime/.env`:

```bash
# Required for skill tests
TEST_GITHUB_TOKEN=ghp_...          # GitHub PAT (repo scope)
TEST_GITHUB_REPO=owner/repo        # Test repository
TEST_GIST_GITHUB_TOKEN=ghp_...     # Classic PAT (gist scope)

# Required for agent tests
ANTHROPIC_API_KEY=sk-ant-...

# Optional
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514   # Override model for agent tests
```

## Running Tests

```bash
# All tests
bun test

# By package
bun run test:format      # @bands/format
bun run test:editor      # @bands/editor
bun run test:runtime     # @bands/runtime (unit + executor)
bun run test:unit        # Runtime unit tests only
bun run test:integration # Runtime integration tests

# Skill tests (require env vars above)
bun run test:skills github         # All github skill tests
bun run test:skills:direct github  # Direct script tests only
bun run test:skills:agent github   # Agent tests only (requires ANTHROPIC_API_KEY)
```

## Building

```bash
# Build format and editor packages
bun run build

# Build standalone CLI binary
bun run install:cli    # → /usr/local/bin/band-cli

# Build locked-down band runner
bun run install:band   # → /usr/local/bin/band

# Type check
bun run typecheck
```

## Next Steps

- [CLI Reference](cli.md) — All commands and options
- [Band Format](band-format.md) — BAND.md specification
- [Creating Skills](creating-skills.md) — Build a banded skill
- [Architecture](architecture.md) — System design
- [Testing](testing.md) — Testing guide
