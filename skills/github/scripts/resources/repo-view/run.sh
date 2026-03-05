#!/bin/bash
INPUT=$(cat "$INPUT_PATH")

REPO=$(echo "$INPUT" | jq -r '.repo')

STDERR_FILE=$(mktemp)
RESULT=$(gh repo view "$REPO" --json name,description,url,stargazerCount,forkCount,primaryLanguage,defaultBranchRef,visibility,repositoryTopics 2>"$STDERR_FILE") || {
  ERROR=$(cat "$STDERR_FILE")
  rm -f "$STDERR_FILE"
  echo "{\"error\": \"$ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
rm -f "$STDERR_FILE"

# Reshape to friendlier format
echo "$RESULT" | jq '{
  name: .name,
  description: .description,
  url: .url,
  stars: .stargazerCount,
  forks: .forkCount,
  language: (.primaryLanguage.name // null),
  defaultBranch: (.defaultBranchRef.name // null),
  visibility: .visibility,
  topics: [.repositoryTopics[]?.name]
}' > "${OUTPUT_PATH:-/dev/stdout}"
