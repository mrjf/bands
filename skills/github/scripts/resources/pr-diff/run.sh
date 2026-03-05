#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
NAME_ONLY=$(echo "$INPUT" | jq -r '.name_only // false')
PATCH=$(echo "$INPUT" | jq -r '.patch // false')

ARGS=("$NUMBER" -R "$REPO" --color never)

if [ "$NAME_ONLY" = "true" ]; then
  ARGS+=(--name-only)
fi

if [ "$PATCH" = "true" ]; then
  ARGS+=(--patch)
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh pr diff "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Return as JSON with diff content
echo "$RESULT" | jq -Rs '{diff: .}' > "${OUTPUT_PATH:-/dev/stdout}"
