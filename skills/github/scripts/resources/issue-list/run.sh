#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
STATE=$(echo "$INPUT" | jq -r '.state // "open"')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 30')
LABELS=$(echo "$INPUT" | jq -r '.labels // empty')
ASSIGNEE=$(echo "$INPUT" | jq -r '.assignee // empty')

ARGS=(-R "$REPO" --state "$STATE" --limit "$LIMIT" --json number,title,state,author,labels,url,createdAt)

if [ -n "$LABELS" ]; then
  ARGS+=(--label "$LABELS")
fi

if [ -n "$ASSIGNEE" ]; then
  ARGS+=(--assignee "$ASSIGNEE")
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh issue list "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
