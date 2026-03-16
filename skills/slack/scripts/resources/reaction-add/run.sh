#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

check_feature "reactions"

INPUT=$(cat "$INPUT_PATH")

CHANNEL=$(echo "$INPUT" | jq -r '.channel')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp')
EMOJI=$(echo "$INPUT" | jq -r '.emoji')

CHANNEL_ID=$(check_channel "$CHANNEL")

# Strip colons from emoji name (e.g., :thumbsup: -> thumbsup)
EMOJI="${EMOJI#:}"
EMOJI="${EMOJI%:}"

BODY=$(jq -n --arg channel "$CHANNEL_ID" --arg timestamp "$TIMESTAMP" --arg name "$EMOJI" \
  '{channel: $channel, timestamp: $timestamp, name: $name}')

RESPONSE=$(slack_api reactions.add "$BODY")

echo "$RESPONSE" | jq '{ok: .ok}' > "${OUTPUT_PATH:-/dev/stdout}"
