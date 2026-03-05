#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')
RUN_ID=$(echo "$INPUT" | jq -r '.run_id')

STDERR_FILE=$(mktemp)
RESULT=$(gh run view "$RUN_ID" -R "$REPO" --json databaseId,name,displayTitle,status,conclusion,event,headBranch,headSha,url,createdAt,updatedAt,jobs,workflowName,attempt,number 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
