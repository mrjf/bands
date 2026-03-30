#!/bin/bash
set -euo pipefail

INPUT=$(cat "$INPUT_PATH")
VOICE_ID=$(echo "$INPUT" | jq -r '.voice_id')
TEXT=$(echo "$INPUT" | jq -r '.text')
MODEL_ID=$(echo "$INPUT" | jq -r '.model_id // "eleven_multilingual_v2"')
STABILITY=$(echo "$INPUT" | jq -r '.stability // 0.5')
SIMILARITY=$(echo "$INPUT" | jq -r '.similarity_boost // 0.75')
OUT_PATH=$(echo "$INPUT" | jq -r '.output_path // "/tmp/tts-output.mp3"')

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo '{"error": "ELEVENLABS_API_KEY is not set"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

HTTP_CODE=$(curl -sf -w "%{http_code}" \
  -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": $(echo "$TEXT" | jq -Rs .),
    \"model_id\": \"$MODEL_ID\",
    \"voice_settings\": {
      \"stability\": $STABILITY,
      \"similarity_boost\": $SIMILARITY
    }
  }" \
  --output "$OUT_PATH" 2>&1) || {
  echo "{\"error\": \"TTS request failed\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

SIZE=$(stat -c%s "$OUT_PATH" 2>/dev/null || stat -f%z "$OUT_PATH" 2>/dev/null || echo 0)
echo "{\"success\": true, \"output_path\": \"$OUT_PATH\", \"size_bytes\": $SIZE}" > "${OUTPUT_PATH:-/dev/stdout}"
