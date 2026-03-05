#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 100')

STDERR_FILE=$(mktemp)
RESULT=$(gh label list -R "$REPO" --limit "$LIMIT" --json name,color,description 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
