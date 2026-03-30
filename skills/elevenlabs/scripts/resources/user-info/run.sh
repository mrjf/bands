#!/bin/bash
set -euo pipefail

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo '{"error": "ELEVENLABS_API_KEY is not set"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

USER=$(curl -sf -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/user" 2>&1) || {
  echo "{\"error\": \"Failed to get user info: $USER\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

SUB=$(curl -sf -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/user/subscription" 2>&1) || {
  echo "{\"error\": \"Failed to get subscription: $SUB\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

# Combine user and subscription info
jq -n --argjson user "$USER" --argjson sub "$SUB" \
  '{user_id: $user.xi_api_key, tier: $sub.tier, character_count: $sub.character_count, character_limit: $sub.character_limit}' \
  > "${OUTPUT_PATH:-/dev/stdout}"
