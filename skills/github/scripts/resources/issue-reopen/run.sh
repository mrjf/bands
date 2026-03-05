#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
COMMENT=$(echo "$INPUT" | jq -r '.comment // empty')

ARGS=("$NUMBER" -R "$REPO")

if [ -n "$COMMENT" ]; then
  ARGS+=(--comment "$COMMENT")
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh issue reopen "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"reopened\": true, \"number\": $NUMBER}" > "${OUTPUT_PATH:-/dev/stdout}"
