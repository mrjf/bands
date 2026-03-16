#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

INPUT=$(cat "$INPUT_PATH")

CHANNEL=$(echo "$INPUT" | jq -r '.channel')
LIMIT=$(echo "$INPUT" | jq -r '.limit // 20')

CHANNEL_ID=$(check_channel "$CHANNEL")

BODY=$(jq -n --arg channel "$CHANNEL_ID" --argjson limit "$LIMIT" \
  '{channel: $channel, limit: $limit}')

RESPONSE=$(slack_api conversations.history "$BODY")

echo "$RESPONSE" | jq "[.messages[]? | {
  type: .type,
  user: .user,
  text: .text,
  ts: .ts,
  thread_ts: .thread_ts,
  reply_count: .reply_count
}] | .[0:$LIMIT]" > "${OUTPUT_PATH:-/dev/stdout}"
