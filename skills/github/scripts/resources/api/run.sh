#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

ENDPOINT=$(echo "$INPUT" | jq -r '.endpoint')
METHOD=$(echo "$INPUT" | jq -r '.method // "GET"')
REQ_BODY=$(echo "$INPUT" | jq -c '.body // empty')
HEADERS=$(echo "$INPUT" | jq -c '.headers // empty')

ARGS=("$ENDPOINT" --method "$METHOD")

# If there's a request body, write it to a temp file and use --input
if [ -n "$REQ_BODY" ]; then
  BODY_FILE=$(mktemp)
  echo "$REQ_BODY" > "$BODY_FILE"
  ARGS+=(--input "$BODY_FILE")
fi

# Parse headers object into -H flags
if [ -n "$HEADERS" ]; then
  for key in $(echo "$HEADERS" | jq -r 'keys[]' 2>/dev/null); do
    val=$(echo "$HEADERS" | jq -r ".\"$key\"")
    ARGS+=(-H "$key:$val")
  done
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh api "${ARGS[@]}" 2>"$STDERR_FILE")
EXIT_CODE=$?

# Clean up temp body file
if [ -n "$BODY_FILE" ]; then
  rm -f "$BODY_FILE"
fi

if [ $EXIT_CODE -ne 0 ]; then
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  # gh api writes error JSON to stdout, messages to stderr — prefer stdout
  if [ -n "$RESULT" ]; then
    echo "{\"error\": $(echo "$RESULT" | jq -Rs .)}" > "${OUTPUT_PATH:-/dev/stdout}"
  else
    echo "{\"error\": $(echo "$ERROR" | jq -Rs .)}" > "${OUTPUT_PATH:-/dev/stdout}"
  fi
  exit 1
fi
rm -f "$STDERR_FILE"

# gh api may return empty for DELETE responses
if [ -z "$RESULT" ]; then
  echo "{\"success\": true}" > "${OUTPUT_PATH:-/dev/stdout}"
else
  echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
fi
