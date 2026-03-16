#!/bin/bash
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

check_feature "files"

INPUT=$(cat "$INPUT_PATH")

CHANNEL=$(echo "$INPUT" | jq -r '.channel')
FILENAME=$(echo "$INPUT" | jq -r '.filename')
CONTENT=$(echo "$INPUT" | jq -r '.content')
TITLE=$(echo "$INPUT" | jq -r '.title // empty')

CHANNEL_ID=$(check_channel "$CHANNEL")

# Step 1: Get upload URL
LENGTH=${#CONTENT}
BODY=$(jq -n --arg filename "$FILENAME" --argjson length "$LENGTH" \
  '{filename: $filename, length: $length}')

RESPONSE=$(slack_api files.getUploadURLExternal "$BODY")

UPLOAD_URL=$(echo "$RESPONSE" | jq -r '.upload_url')
FILE_ID=$(echo "$RESPONSE" | jq -r '.file_id')

# Step 2: Upload content to the URL
UPLOAD_RESULT=$(curl -s -X POST "$UPLOAD_URL" \
  -F "content=$CONTENT")

# Step 3: Complete the upload
COMPLETE_BODY=$(jq -n \
  --arg file_id "$FILE_ID" \
  --arg channel "$CHANNEL_ID" \
  '{files: [{id: $file_id}], channel_id: $channel}')

if [ -n "$TITLE" ]; then
  COMPLETE_BODY=$(echo "$COMPLETE_BODY" | jq --arg title "$TITLE" '. + {initial_comment: $title}')
fi

COMPLETE_RESPONSE=$(slack_api files.completeUploadExternal "$COMPLETE_BODY")

echo "$COMPLETE_RESPONSE" | jq '{
  ok: .ok,
  files: [.files[]? | {id: .id, name: .name}]
}' > "${OUTPUT_PATH:-/dev/stdout}"
