#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

FILENAME=$(echo "$INPUT" | jq -r '.filename // "file.txt"')
CONTENT=$(echo "$INPUT" | jq -r '.content')
DESCRIPTION=$(echo "$INPUT" | jq -r '.description // empty')
PUBLIC=$(echo "$INPUT" | jq -r '.public // false')

ARGS=(--filename "$FILENAME")

if [ -n "$DESCRIPTION" ]; then
  ARGS+=(--desc "$DESCRIPTION")
fi

if [ "$PUBLIC" = "true" ]; then
  ARGS+=(--public)
fi

# Pipe content into gh gist create
STDERR_FILE=$(mktemp)
URL=$(echo "$CONTENT" | gh gist create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Extract gist ID from URL
GIST_ID=$(echo "$URL" | grep -oE '[a-f0-9]{20,}' | head -1)
echo "{\"url\": \"$URL\", \"id\": \"$GIST_ID\"}" > "${OUTPUT_PATH:-/dev/stdout}"
