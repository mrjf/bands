#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 30')

STDERR_FILE=$(mktemp)
RESULT=$(gh release list -R "$REPO" --limit "$LIMIT" --json tagName,name,isDraft,isPrerelease,isLatest,publishedAt,createdAt 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
