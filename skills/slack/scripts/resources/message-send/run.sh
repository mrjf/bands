#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

INPUT=$(cat "$INPUT_PATH")

CHANNEL=$(echo "$INPUT" | jq -r '.channel')
TEXT=$(echo "$INPUT" | jq -r '.text')
THREAD_TS=$(echo "$INPUT" | jq -r '.thread_ts // empty')

CHANNEL_ID=$(check_channel "$CHANNEL")

BODY=$(jq -n --arg channel "$CHANNEL_ID" --arg text "$TEXT" \
  '{channel: $channel, text: $text}')

if [ -n "$THREAD_TS" ]; then
  check_feature "threads"
  BODY=$(echo "$BODY" | jq --arg ts "$THREAD_TS" '. + {thread_ts: $ts}')
fi

RESPONSE=$(slack_api chat.postMessage "$BODY")

echo "$RESPONSE" | jq '{
  ok: .ok,
  channel: .channel,
  ts: .ts,
  message: {text: .message.text, ts: .message.ts}
}' > "${OUTPUT_PATH:-/dev/stdout}"
