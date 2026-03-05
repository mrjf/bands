#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
EVENT=$(echo "$INPUT" | jq -r '.event // "COMMENT"')
BODY=$(echo "$INPUT" | jq -r '.body // empty')

ARGS=("$NUMBER" -R "$REPO")

case "$EVENT" in
  APPROVE) ARGS+=(--approve) ;;
  REQUEST_CHANGES) ARGS+=(--request-changes) ;;
  *) ARGS+=(--comment) ;;
esac

if [ -n "$BODY" ]; then
  ARGS+=(--body "$BODY")
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh pr review "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"state\": \"$EVENT\", \"message\": \"Review submitted\"}" > "${OUTPUT_PATH:-/dev/stdout}"
