#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
METHOD=$(echo "$INPUT" | jq -r '.method // "merge"')
DELETE_BRANCH=$(echo "$INPUT" | jq -r '.delete_branch // false')

ARGS=("$NUMBER" -R "$REPO")

case "$METHOD" in
  squash) ARGS+=(--squash) ;;
  rebase) ARGS+=(--rebase) ;;
  *) ARGS+=(--merge) ;;
esac

if [ "$DELETE_BRANCH" = "true" ]; then
  ARGS+=(--delete-branch)
fi

# gh pr merge outputs text, not JSON
STDERR_FILE=$(mktemp)
RESULT=$(gh pr merge "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "{\"merged\": true, \"message\": \"$RESULT\"}" > "${OUTPUT_PATH:-/dev/stdout}"
