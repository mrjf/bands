#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
TITLE=$(echo "$INPUT" | jq -r '.title')
HEAD=$(echo "$INPUT" | jq -r '.head')
BODY=$(echo "$INPUT" | jq -r '.body // empty')
BASE=$(echo "$INPUT" | jq -r '.base // empty')
DRAFT=$(echo "$INPUT" | jq -r '.draft // false')

ARGS=(-R "$REPO" --title "$TITLE" --head "$HEAD")

ARGS+=(--body "$BODY")

if [ -n "$BASE" ]; then
  ARGS+=(--base "$BASE")
fi

if [ "$DRAFT" = "true" ]; then
  ARGS+=(--draft)
fi

# Add labels
LABELS=$(echo "$INPUT" | jq -r '.labels // [] | .[]' 2>/dev/null)
for label in $LABELS; do
  ARGS+=(--label "$label")
done

# Add reviewers
REVIEWERS=$(echo "$INPUT" | jq -r '.reviewers // [] | .[]' 2>/dev/null)
for reviewer in $REVIEWERS; do
  ARGS+=(--reviewer "$reviewer")
done

# gh pr create outputs a URL like: https://github.com/owner/repo/pull/123
STDERR_FILE=$(mktemp)
URL=$(gh pr create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Extract PR number from URL
NUMBER=$(echo "$URL" | grep -oE '[0-9]+$')
echo "{\"number\": $NUMBER, \"url\": \"$URL\", \"title\": \"$TITLE\"}" > "${OUTPUT_PATH:-/dev/stdout}"
