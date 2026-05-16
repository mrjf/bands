#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
TITLE=$(echo "$INPUT" | jq -r '.title')
HEAD=$(echo "$INPUT" | jq -r '.head')
BODY=$(echo "$INPUT" | jq -r '.body // empty')
BASE=$(echo "$INPUT" | jq -r '.base // empty')
DRAFT=$(echo "$INPUT" | jq -r '.draft // false')
MILESTONE=$(echo "$INPUT" | jq -r '.milestone // empty')

ARGS=(-R "$REPO" --title "$TITLE" --head "$HEAD")

ARGS+=(--body "$BODY")

if [ -n "$BASE" ]; then
  ARGS+=(--base "$BASE")
fi

if [ "$DRAFT" = "true" ]; then
  ARGS+=(--draft)
fi

if [ -n "$MILESTONE" ]; then
  ARGS+=(--milestone "$MILESTONE")
fi

# Add labels
while IFS= read -r label; do
  [ -n "$label" ] && ARGS+=(--label "$label")
done < <(echo "$INPUT" | jq -r '.labels // [] | .[]' 2>/dev/null)

# Add reviewers
while IFS= read -r reviewer; do
  [ -n "$reviewer" ] && ARGS+=(--reviewer "$reviewer")
done < <(echo "$INPUT" | jq -r '.reviewers // [] | .[]' 2>/dev/null)

# Add assignees
while IFS= read -r assignee; do
  [ -n "$assignee" ] && ARGS+=(--assignee "$assignee")
done < <(echo "$INPUT" | jq -r '.assignees // [] | .[]' 2>/dev/null)

# gh pr create outputs a URL like: https://github.com/owner/repo/pull/123
STDERR_FILE=$(mktemp)
URL=$(gh pr create "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  jq -n --arg err "$ERROR" '{"error": $err}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Extract PR number from URL
NUMBER=$(echo "$URL" | grep -oE '[0-9]+$')
jq -n --argjson num "$NUMBER" --arg url "$URL" --arg title "$TITLE" \
  '{"number": $num, "url": $url, "title": $title}' > "${OUTPUT_PATH:-/dev/stdout}"
