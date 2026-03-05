#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NAME=$(echo "$INPUT" | jq -r '.name')

STDERR_FILE=$(mktemp)
RESULT=$(gh label delete "$NAME" -R "$REPO" --yes 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"deleted\": true, \"name\": \"$NAME\"}" > "${OUTPUT_PATH:-/dev/stdout}"
