#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 20')
WORKFLOW=$(echo "$INPUT" | jq -r '.workflow // empty')
STATUS=$(echo "$INPUT" | jq -r '.status // empty')
BRANCH=$(echo "$INPUT" | jq -r '.branch // empty')

ARGS=(-R "$REPO" --limit "$LIMIT" --json databaseId,name,status,conclusion,headBranch,url,createdAt,event)

if [ -n "$WORKFLOW" ]; then
  ARGS+=(--workflow "$WORKFLOW")
fi

if [ -n "$STATUS" ]; then
  ARGS+=(--status "$STATUS")
fi

if [ -n "$BRANCH" ]; then
  ARGS+=(--branch "$BRANCH")
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh run list "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
