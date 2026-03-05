#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
COMMENTS=$(echo "$INPUT" | jq -r '.comments // false')

FIELDS="number,title,state,body,author,labels,assignees,milestone,url,createdAt,updatedAt"

if [ "$COMMENTS" = "true" ]; then
  FIELDS="$FIELDS,comments"
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh issue view "$NUMBER" -R "$REPO" --json "$FIELDS" 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
