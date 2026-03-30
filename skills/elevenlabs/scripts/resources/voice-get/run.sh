#!/bin/bash
set -euo pipefail

INPUT=$(cat "$INPUT_PATH")
VOICE_ID=$(echo "$INPUT" | jq -r '.voice_id')

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo '{"error": "ELEVENLABS_API_KEY is not set"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

RESULT=$(curl -sf -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices/$VOICE_ID" 2>&1) || {
  echo "{\"error\": \"Failed to get voice: $RESULT\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

echo "$RESULT" | jq '{voice_id, name, category, description, labels, preview_url}' > "${OUTPUT_PATH:-/dev/stdout}"
