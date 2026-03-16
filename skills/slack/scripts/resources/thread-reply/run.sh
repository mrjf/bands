#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

check_feature "threads"

INPUT=$(cat "$INPUT_PATH")

CHANNEL=$(echo "$INPUT" | jq -r '.channel')
THREAD_TS=$(echo "$INPUT" | jq -r '.thread_ts')
TEXT=$(echo "$INPUT" | jq -r '.text')

CHANNEL_ID=$(check_channel "$CHANNEL")

BODY=$(jq -n --arg channel "$CHANNEL_ID" --arg text "$TEXT" --arg thread_ts "$THREAD_TS" \
  '{channel: $channel, text: $text, thread_ts: $thread_ts}')

RESPONSE=$(slack_api chat.postMessage "$BODY")

echo "$RESPONSE" | jq '{
  ok: .ok,
  channel: .channel,
  ts: .ts,
  message: {text: .message.text, ts: .message.ts}
}' > "${OUTPUT_PATH:-/dev/stdout}"
