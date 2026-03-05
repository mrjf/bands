#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
TITLE=$(echo "$INPUT" | jq -r '.title')
BODY=$(echo "$INPUT" | jq -r '.body // empty')
MILESTONE=$(echo "$INPUT" | jq -r '.milestone // empty')

ARGS=(-R "$REPO" --title "$TITLE")

if [ -n "$BODY" ]; then
  ARGS+=(--body "$BODY")
fi

if [ -n "$MILESTONE" ]; then
  ARGS+=(--milestone "$MILESTONE")
fi

# Add labels
LABELS=$(echo "$INPUT" | jq -r '.labels // [] | .[]' 2>/dev/null)
for label in $LABELS; do
  ARGS+=(--label "$label")
done

# Add assignees
ASSIGNEES=$(echo "$INPUT" | jq -r '.assignees // [] | .[]' 2>/dev/null)
for assignee in $ASSIGNEES; do
  ARGS+=(--assignee "$assignee")
done

# gh issue create outputs a URL like: https://github.com/owner/repo/issues/123
STDERR_FILE=$(mktemp)
URL=$(gh issue create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Extract issue number from URL
NUMBER=$(echo "$URL" | grep -oE '[0-9]+$')
echo "{\"number\": $NUMBER, \"url\": \"$URL\", \"title\": \"$TITLE\"}" > "${OUTPUT_PATH:-/dev/stdout}"
