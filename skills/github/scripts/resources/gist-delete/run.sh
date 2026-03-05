#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

GIST_ID=$(echo "$INPUT" | jq -r '.id')

STDERR_FILE=$(mktemp)
RESULT=$(gh gist delete "$GIST_ID" --yes 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"deleted\": true, \"id\": \"$GIST_ID\"}" > "${OUTPUT_PATH:-/dev/stdout}"
