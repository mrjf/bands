#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
TAG=$(echo "$INPUT" | jq -r '.tag')
TITLE=$(echo "$INPUT" | jq -r '.title // empty')
NOTES=$(echo "$INPUT" | jq -r '.notes // empty')
DRAFT=$(echo "$INPUT" | jq -r '.draft // false')
PRERELEASE=$(echo "$INPUT" | jq -r '.prerelease // false')
TARGET=$(echo "$INPUT" | jq -r '.target // empty')
GENERATE_NOTES=$(echo "$INPUT" | jq -r '.generate_notes // false')

ARGS=("$TAG" -R "$REPO")

if [ -n "$TITLE" ]; then
  ARGS+=(--title "$TITLE")
fi

if [ -n "$NOTES" ]; then
  ARGS+=(--notes "$NOTES")
fi

if [ "$DRAFT" = "true" ]; then
  ARGS+=(--draft)
fi

if [ "$PRERELEASE" = "true" ]; then
  ARGS+=(--prerelease)
fi

if [ -n "$TARGET" ]; then
  ARGS+=(--target "$TARGET")
fi

if [ "$GENERATE_NOTES" = "true" ]; then
  ARGS+=(--generate-notes)
fi

STDERR_FILE=$(mktemp)
URL=$(gh release create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"url\": \"$URL\", \"tag\": \"$TAG\"}" > "${OUTPUT_PATH:-/dev/stdout}"
