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
while IFS= read -r label; do
  [ -n "$label" ] && ARGS+=(--label "$label")
done < <(echo "$INPUT" | jq -r '.labels // [] | .[]' 2>/dev/null)

# Add assignees
while IFS= read -r assignee; do
  [ -n "$assignee" ] && ARGS+=(--assignee "$assignee")
done < <(echo "$INPUT" | jq -r '.assignees // [] | .[]' 2>/dev/null)

# gh issue create outputs a URL like: https://github.com/owner/repo/issues/123
STDERR_FILE=$(mktemp)
URL=$(gh issue create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  jq -n --arg err "$ERROR" '{"error": $err}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Extract issue number from URL
NUMBER=$(echo "$URL" | grep -oE '[0-9]+$')
jq -n --argjson num "$NUMBER" --arg url "$URL" --arg title "$TITLE" \
  '{"number": $num, "url": $url, "title": $title}' > "${OUTPUT_PATH:-/dev/stdout}"
