#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
TITLE=$(echo "$INPUT" | jq -r '.title // empty')
BODY=$(echo "$INPUT" | jq -r '.body // empty')
MILESTONE=$(echo "$INPUT" | jq -r '.milestone // empty')

ARGS=("$NUMBER" -R "$REPO")

if [ -n "$TITLE" ]; then
  ARGS+=(--title "$TITLE")
fi

if [ -n "$BODY" ]; then
  ARGS+=(--body "$BODY")
fi

if [ -n "$MILESTONE" ]; then
  ARGS+=(--milestone "$MILESTONE")
fi

# Add labels
ADD_LABELS=$(echo "$INPUT" | jq -r '.add_labels // [] | .[]' 2>/dev/null)
for label in $ADD_LABELS; do
  ARGS+=(--add-label "$label")
done

# Remove labels
REMOVE_LABELS=$(echo "$INPUT" | jq -r '.remove_labels // [] | .[]' 2>/dev/null)
for label in $REMOVE_LABELS; do
  ARGS+=(--remove-label "$label")
done

# Add assignees
ADD_ASSIGNEES=$(echo "$INPUT" | jq -r '.add_assignees // [] | .[]' 2>/dev/null)
for assignee in $ADD_ASSIGNEES; do
  ARGS+=(--add-assignee "$assignee")
done

# Remove assignees
REMOVE_ASSIGNEES=$(echo "$INPUT" | jq -r '.remove_assignees // [] | .[]' 2>/dev/null)
for assignee in $REMOVE_ASSIGNEES; do
  ARGS+=(--remove-assignee "$assignee")
done

STDERR_FILE=$(mktemp)
RESULT=$(gh issue edit "${ARGS[@]}" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# gh issue edit outputs a URL on success
URL=$(echo "$RESULT" | grep -oE 'https://github.com/[^ ]+' | head -1)
echo "{\"edited\": true, \"number\": $NUMBER, \"url\": \"$URL\"}" > "${OUTPUT_PATH:-/dev/stdout}"
