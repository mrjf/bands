#!/bin/bash
set -euo pipefail

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo '{"error": "ELEVENLABS_API_KEY is not set"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

RESULT=$(curl -sf -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices" 2>&1) || {
  echo "{\"error\": \"Failed to list voices: $RESULT\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

# Extract voice id and name pairs
echo "$RESULT" | jq '[.voices[] | {voice_id, name, category}]' > "${OUTPUT_PATH:-/dev/stdout}"
