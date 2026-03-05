#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
COMMENT=$(echo "$INPUT" | jq -r '.comment // empty')
DELETE_BRANCH=$(echo "$INPUT" | jq -r '.delete_branch // false')

ARGS=("$NUMBER" -R "$REPO")

if [ -n "$COMMENT" ]; then
  ARGS+=(--comment "$COMMENT")
fi

if [ "$DELETE_BRANCH" = "true" ]; then
  ARGS+=(--delete-branch)
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh pr close "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"closed\": true, \"number\": $NUMBER}" > "${OUTPUT_PATH:-/dev/stdout}"
