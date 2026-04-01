#!/bin/bash
set -euo pipefail

INPUT=$(cat "$INPUT_PATH")
TEXT=$(echo "$INPUT" | jq -r '.text')
DURATION=$(echo "$INPUT" | jq -r '.duration_seconds // 5.0')
OUT_PATH=$(echo "$INPUT" | jq -r '.output_path // "/tmp/sfx-output.mp3"')

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo '{"error": "ELEVENLABS_API_KEY is not set"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

curl -sf -X POST "https://api.elevenlabs.io/v1/sound-generation" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": $(echo "$TEXT" | jq -Rs .),
    \"duration_seconds\": $DURATION
  }" \
  --output "$OUT_PATH" 2>&1 || {
  echo "{\"error\": \"Sound generation failed\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

SIZE=$(stat -c%s "$OUT_PATH" 2>/dev/null || stat -f%z "$OUT_PATH" 2>/dev/null || echo 0)
echo "{\"success\": true, \"output_path\": \"$OUT_PATH\", \"size_bytes\": $SIZE}" > "${OUTPUT_PATH:-/dev/stdout}"
