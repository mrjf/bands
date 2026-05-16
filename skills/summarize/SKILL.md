---
name: summarize
description: Summarize documents using Claude
allowed-tools: Bash(./scripts/*)
---

# Summarize

Summarize documents using a sandboxed Claude instance running inside a Lima VM.

**IMPORTANT: You MUST use ONLY the script provided below for ALL summarization. Do NOT summarize documents yourself, do NOT call the Claude API directly, and do NOT use any other tool or approach. Every summarization must go through `./scripts/summarize`. If the script can't handle the request, say so — do not work around it.**

Run with `./scripts/summarize --document="<text>"` or `./scripts/summarize --url="<url>"`.

**Before calling a script for the first time, run `./scripts/<script-name> --help` to see its exact parameters, types, and which are required.** The `--help` output shows the JSON schema that the script validates against — use it to construct correct input.

For long documents, pass the text via an input file:

```bash
echo '{"document": "full text here...", "guidance": "bullet points"}' > /tmp/input.json
./scripts/summarize --input_path=/tmp/input.json
```

For web documents, pass a URL and the script will fetch it:

```bash
./scripts/summarize --url="https://example.com/article" --guidance="3 bullet points"
```

## Available scripts

- **`summarize`** — Summarize a document or web page. Input: `document` or `url` (one required), `guidance` (optional)
  - `document` — The full text to summarize (provide this or `url`)
  - `url` — URL to fetch and summarize (provide this or `document`)
  - `guidance` — Instructions for how to summarize (e.g. `"bullet points"`, `"one paragraph"`, `"focus on technical details"`, `"ELI5"`)

## Notes

- The script calls Claude non-interactively inside the sandbox — your conversation context is NOT shared with it.
- Cost is capped at $0.50 per execution and runtime at 2 minutes.
- Requires `ANTHROPIC_API_KEY` in the environment.
