#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
NUMBER=$(echo "$INPUT" | jq -r '.number')
REQUIRED=$(echo "$INPUT" | jq -r '.required // false')

ARGS=("$NUMBER" -R "$REPO" --json name,state,bucket,description,link,startedAt,completedAt,event,workflow)

if [ "$REQUIRED" = "true" ]; then
  ARGS+=(--required)
fi

STDERR_FILE=$(mktemp)
RESULT=$(gh pr checks "${ARGS[@]}" 2>"$STDERR_FILE")
EXIT_CODE=$?

# Exit code 8 means checks pending — still valid
# "no checks" message means no CI configured — return empty array
if [ $EXIT_CODE -ne 0 ] && [ $EXIT_CODE -ne 8 ]; then
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  if echo "$ERROR" | grep -qi "no checks"; then
    echo "[]" > "${OUTPUT_PATH:-/dev/stdout}"
    exit 0
  fi
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi
rm -f "$STDERR_FILE"

# gh pr checks may return empty when pending
if [ -z "$RESULT" ]; then
  echo "[]" > "${OUTPUT_PATH:-/dev/stdout}"
else
  echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
fi
