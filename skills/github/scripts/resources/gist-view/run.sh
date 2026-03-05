#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

GIST_ID=$(echo "$INPUT" | jq -r '.id')

STDERR_FILE=$(mktemp)
RESULT=$(gh api "gists/$GIST_ID" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Transform API response to expected format
echo "$RESULT" | jq '{
  id: .id,
  description: .description,
  public: .public,
  url: .html_url,
  createdAt: .created_at,
  updatedAt: .updated_at,
  owner: { login: .owner.login, id: .owner.id },
  files: [.files | to_entries[] | { filename: .key, language: .value.language, size: .value.size }]
}' > "${OUTPUT_PATH:-/dev/stdout}"
