# Contributing

Bands is a pre-alpha research project. Expect breaking changes.

## How to contribute

**Open issues, not pull requests.**

We use an AI agent to write code from issues. If you find a bug, have a feature request, or want to suggest an improvement, open an issue describing what you need. The agent will create the PR.

If you open a PR directly, we'll likely close it and convert it to an issue.

## What to include in an issue

- What you expected vs what happened
- Steps to reproduce (for bugs)
- Which execution target you're using (`local-dangerously`, `lima`)
- Your environment (OS, Bun version)

## Experimental packages

The `@bands/editor` package is experimental and under active development. Its API and UI are unstable.

## Running tests

```bash
bun install
bun test          # Unit tests (format, editor, runtime)
bun test:all      # Unit + integration + executor tests
bun test:skills   # Skill tests (requires API keys in .env)
```

See `docs/getting-started.md` for full setup instructions.
