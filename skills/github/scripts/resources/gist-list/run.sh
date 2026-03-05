#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

LIMIT=$(echo "$INPUT" | jq -r '.limit // 10')
PUBLIC=$(echo "$INPUT" | jq -r '.public // empty')
SECRET=$(echo "$INPUT" | jq -r '.secret // empty')

ARGS=(--limit "$LIMIT")

if [ "$PUBLIC" = "true" ]; then
  ARGS+=(--public)
fi

if [ "$SECRET" = "true" ]; then
  ARGS+=(--secret)
fi

# gh gist list doesn't support --json, so use gh api instead
STDERR_FILE=$(mktemp)
RESULT=$(gh api gists --method GET --paginate -q ".[0:$LIMIT]" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": $(echo "$ERROR" | jq -Rs .)}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Reshape to match output schema
echo "$RESULT" | jq "[.[] | {id: .id, description: .description, files: [.files | keys[]], public: .public, updatedAt: .updated_at, url: .html_url}] | .[0:$LIMIT]" > "${OUTPUT_PATH:-/dev/stdout}"
