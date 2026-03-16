#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

INPUT=$(cat "$INPUT_PATH")

CHANNEL=$(echo "$INPUT" | jq -r '.channel')
CHANNEL_ID=$(check_channel "$CHANNEL")

RESPONSE=$(curl -s \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.info?channel=$CHANNEL_ID")

ok=$(echo "$RESPONSE" | jq -r '.ok')
if [ "$ok" != "true" ]; then
  error_msg=$(echo "$RESPONSE" | jq -r '.error // "Unknown Slack API error"')
  echo "{\"error\": \"Slack API error (conversations.info): $error_msg\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

echo "$RESPONSE" | jq '.channel | {
  id: .id,
  name: .name,
  topic: .topic.value,
  purpose: .purpose.value,
  num_members: .num_members,
  is_private: .is_private,
  is_archived: .is_archived,
  created: .created
}' > "${OUTPUT_PATH:-/dev/stdout}"
