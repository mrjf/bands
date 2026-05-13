#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

QUERY=$(echo "$INPUT" | jq -r '.query')
TYPE=$(echo "$INPUT" | jq -r '.type // "issues"')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 30')
REPO=$(echo "$INPUT" | jq -r '.repo // empty')

# Build common args
EXTRA_ARGS=()
if [ -n "$REPO" ]; then
  EXTRA_ARGS+=(--repo "$REPO")
fi

run_search() {
  case "$TYPE" in
    repos|repositories)
      gh search repos "$QUERY" --limit "$LIMIT" "${EXTRA_ARGS[@]}" --json fullName,description,url,stargazersCount,language,updatedAt
      ;;
    prs)
      gh search prs "$QUERY" --limit "$LIMIT" "${EXTRA_ARGS[@]}" --json repository,number,title,state,author,url,createdAt
      ;;
    code)
      gh search code "$QUERY" --limit "$LIMIT" "${EXTRA_ARGS[@]}" --json repository,path,url
      ;;
    *)
      gh search issues "$QUERY" --limit "$LIMIT" "${EXTRA_ARGS[@]}" --json repository,number,title,state,author,url,createdAt
      ;;
  esac
}

STDERR_FILE=$(mktemp)
RESULT=$(run_search 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# gh search returns [] for no results, but may return empty string
if [ -z "$RESULT" ]; then
  echo "[]" > "${OUTPUT_PATH:-/dev/stdout}"
else
  echo "$RESULT" > "${OUTPUT_PATH:-/dev/stdout}"
fi
