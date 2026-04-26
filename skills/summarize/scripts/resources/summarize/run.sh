#!/bin/bash
# Summarize a document using Claude Code CLI in non-interactive mode.
# Reads from $INPUT_PATH, writes to $OUTPUT_PATH.
# Accepts either a "document" (inline text) or "url" (fetched with curl).
# Requires ANTHROPIC_API_KEY in environment (injected by band server).

INPUT=$(cat "$INPUT_PATH")

DOCUMENT=$(echo "$INPUT" | jq -r '.document // empty')
URL=$(echo "$INPUT" | jq -r '.url // empty')
GUIDANCE=$(echo "$INPUT" | jq -r '.guidance // empty')

# Fetch from URL if provided
if [ -n "$URL" ]; then
  DOCUMENT=$(curl -sfL --max-time 30 "$URL")
  if [ $? -ne 0 ] || [ -z "$DOCUMENT" ]; then
    echo "{\"error\": \"Failed to fetch URL: $URL\"}" > "$OUTPUT_PATH"
    exit 1
  fi
fi

if [ -z "$DOCUMENT" ]; then
  echo '{"error": "Either document or url field is required"}' > "$OUTPUT_PATH"
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
STDERR_FILE=$(mktemp)
RESULT=$(claude --bare --print --no-session-persistence --max-budget-usd 0.25 "$PROMPT" 2>"$STDERR_FILE")
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ] || [ -z "$RESULT" ]; then
  STDERR=$(cat "$STDERR_FILE" 2>/dev/null | head -5 | tr '\n' ' ')
  rm -f "$STDERR_FILE"
  ESCAPED_ERR=$(echo "$STDERR" | jq -Rs .)
  echo "{\"error\": ${ESCAPED_ERR}}" > "$OUTPUT_PATH"
  exit 1
fi
rm -f "$STDERR_FILE"

# Escape the result for JSON output
ESCAPED=$(echo "$RESULT" | jq -Rs .)

echo "{\"summary\": ${ESCAPED}}" > "$OUTPUT_PATH"
