#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
STATE=$(echo "$INPUT" | jq -r '.state // "open"')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 30')
BASE=$(echo "$INPUT" | jq -r '.base // empty')
HEAD=$(echo "$INPUT" | jq -r '.head // empty')
LABEL=$(echo "$INPUT" | jq -r '.label // empty')

ARGS=(-R "$REPO" --state "$STATE" --limit "$LIMIT" --json number,title,state,author,headRefName,baseRefName,url,createdAt,isDraft)

if [ -n "$BASE" ]; then
  ARGS+=(--base "$BASE")
fi

if [ -n "$HEAD" ]; then
  ARGS+=(--head "$HEAD")
fi

if [ -n "$LABEL" ]; then
  ARGS+=(--label "$LABEL")
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh pr list "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
