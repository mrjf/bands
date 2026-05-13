# Contributing

Pre-alpha. Expect breaking changes.

## Open issues, not pull requests

We use an AI agent to write code from issues. Describe what you need — the agent creates the PR.

PRs opened directly will be converted to issues.

## What to include

- What you expected vs what happened
- Steps to reproduce
- Which execution target you're using (`lima`, `cloudflare`)
- Environment (OS, Bun version)

## Tests

```bash
bun install
bun test
bun test:all
bun test:skills
```

See `docs/getting-started.md` for full setup.
