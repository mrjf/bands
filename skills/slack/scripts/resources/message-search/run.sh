#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

check_feature "search"

INPUT=$(cat "$INPUT_PATH")

QUERY=$(echo "$INPUT" | jq -r '.query')
CHANNEL=$(echo "$INPUT" | jq -r '.channel // empty')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 20')

# search.messages requires a user token (xoxp-)
TOKEN="${SLACK_USER_TOKEN:-$SLACK_BOT_TOKEN}"

if [ -n "$CHANNEL" ]; then
  CHANNEL_ID=$(check_channel "$CHANNEL")
  QUERY="in:<#$CHANNEL_ID> $QUERY"
fi

ENCODED_QUERY=$(printf '%s' "$QUERY" | jq -sRr @uri)

RESPONSE=$(curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "https://slack.com/api/search.messages?query=${ENCODED_QUERY}&count=${LIMIT}")

OK=$(echo "$RESPONSE" | jq -r '.ok')
if [ "$OK" != "true" ]; then
  ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
  echo "{\"error\": \"Slack API error (search.messages): $ERROR\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

echo "$RESPONSE" | jq "{
  total: .messages.total,
  matches: [.messages.matches[:$LIMIT][]? | {
    text: .text,
    username: .username,
    channel: {id: .channel.id, name: .channel.name},
    ts: .ts,
    permalink: .permalink
  }]
}" > "${OUTPUT_PATH:-/dev/stdout}"
