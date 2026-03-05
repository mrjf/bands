#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
TAG=$(echo "$INPUT" | jq -r '.tag // empty')

if [ -n "$TAG" ]; then
  ARGS=("$TAG" -R "$REPO" --json tagName,name,body,isDraft,isPrerelease,publishedAt,url,author,assets)
else
  ARGS=(-R "$REPO" --json tagName,name,body,isDraft,isPrerelease,publishedAt,url,author,assets)
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh release view "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
