#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

INPUT=$(cat "$INPUT_PATH")

LIMIT=$(echo "$INPUT" | jq -r '.limit // 100')
TYPES=$(echo "$INPUT" | jq -r '.types // "public_channel"')

BODY=$(jq -n --arg types "$TYPES" --argjson limit "$LIMIT" \
  '{types: $types, limit: $limit, exclude_archived: true}')

RESPONSE=$(slack_api conversations.list "$BODY")

echo "$RESPONSE" | jq "[.channels[]? | {
  id: .id,
  name: .name,
  topic: .topic.value,
  purpose: .purpose.value,
  num_members: .num_members,
  is_private: .is_private,
  is_archived: .is_archived
}] | .[0:$LIMIT]" > "${OUTPUT_PATH:-/dev/stdout}"
