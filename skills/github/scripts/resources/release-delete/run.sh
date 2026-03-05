#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
TAG=$(echo "$INPUT" | jq -r '.tag')
CLEANUP_TAG=$(echo "$INPUT" | jq -r '.cleanup_tag // false')

ARGS=("$TAG" -R "$REPO" --yes)

if [ "$CLEANUP_TAG" = "true" ]; then
  ARGS+=(--cleanup-tag)
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh release delete "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"deleted\": true, \"tag\": \"$TAG\"}" > "${OUTPUT_PATH:-/dev/stdout}"
