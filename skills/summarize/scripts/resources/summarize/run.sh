#!/bin/bash
# Summarize a document using Claude Code CLI in non-interactive mode.
# Reads from $INPUT_PATH, writes to $OUTPUT_PATH.
# Requires ANTHROPIC_API_KEY in environment (injected by band server).

INPUT=$(cat "$INPUT_PATH")

DOCUMENT=$(echo "$INPUT" | jq -r '.document')
GUIDANCE=$(echo "$INPUT" | jq -r '.guidance // empty')

if [ -z "$DOCUMENT" ] || [ "$DOCUMENT" = "null" ]; then
  echo '{"error": "document field is required"}' > "$OUTPUT_PATH"
  exit 1
fi

# Build the prompt
PROMPT="Summarize the following document."
if [ -n "$GUIDANCE" ]; then
  PROMPT="Summarize the following document. ${GUIDANCE}"
fi
PROMPT="${PROMPT}

Respond with ONLY the summary text, no preamble or explanation.

---

${DOCUMENT}"

# Run Claude Code CLI in non-interactive mode
# --bare: skip hooks, LSP, auto-memory, CLAUDE.md discovery
# --print: non-interactive, output to stdout
# --no-session-persistence: don't save session to disk
# --max-budget-usd: cost guard (band also enforces maxCostDollars)
RESULT=$(claude --bare --print --no-session-persistence --max-budget-usd 0.25 "$PROMPT" 2>/dev/null)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ] || [ -z "$RESULT" ]; then
  echo '{"error": "claude CLI failed"}' > "$OUTPUT_PATH"
  exit 1
fi

# Escape the result for JSON output
ESCAPED=$(echo "$RESULT" | jq -Rs .)

echo "{\"summary\": ${ESCAPED}}" > "$OUTPUT_PATH"
