#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
BODY=$(echo "$INPUT" | jq -r '.body')

STDERR_FILE=$(mktemp)
RESULT=$(gh issue comment "$NUMBER" -R "$REPO" --body "$BODY" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# gh issue comment doesn't support --json, so we parse the URL from output
COMMENT_URL=$(echo "$RESULT" | grep -oE 'https://github.com/[^ ]+' | head -1)
echo "{\"url\": \"$COMMENT_URL\"}" > "${OUTPUT_PATH:-/dev/stdout}"
