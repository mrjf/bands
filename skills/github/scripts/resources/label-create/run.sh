#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NAME=$(echo "$INPUT" | jq -r '.name')
COLOR=$(echo "$INPUT" | jq -r '.color // "ededed"')
DESCRIPTION=$(echo "$INPUT" | jq -r '.description // empty')

ARGS=("$NAME" -R "$REPO" --color "$COLOR")

if [ -n "$DESCRIPTION" ]; then
  ARGS+=(--description "$DESCRIPTION")
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh label create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"created\": true, \"name\": \"$NAME\", \"color\": \"$COLOR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
