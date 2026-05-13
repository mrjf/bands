# Getting started

## Prerequisites

- [Bun](https://bun.sh) v1.3+
- macOS or Linux
- [Lima](https://lima-vm.io/) for VM execution (`brew install lima`)

## Setup

```bash
git clone https://github.com/mrjf/bands.git
cd bands
bun install
bun test
```

## Lima VM

```bash
bun run band setup
bun run band targets
```

Setup creates a `bands-executor` VM with Bun, iptables, bubblewrap, the `band-runner` user, and the band server on port 9000.

```bash
bun run band run examples/minimal.band.md --target local-lima --input '{"message": "hello"}'
```

## Environment

Create `.env` at the project root:

```bash
TEST_GITHUB_TOKEN=ghp_...
TEST_GITHUB_REPO=owner/repo
TEST_GIST_GITHUB_TOKEN=ghp_...
ANTHROPIC_API_KEY=sk-ant-...
```

## Tests

```bash
bun test                       # Unit tests
bun test:all                   # Unit + integration
bun test:skills github         # Skill tests (requires env vars)
bun test:skills:agent github   # Agent mode (requires ANTHROPIC_API_KEY)
```

## Build

```bash
bun run build           # Format + editor packages
bun run install:cli     # Standalone CLI binary
bun run install:band    # Locked-down band runner
bun run typecheck
```

## Next

- [Band format](band-format.md)
- [CLI reference](cli.md)
- [Creating skills](creating-skills.md)
- [Architecture](architecture.md)
