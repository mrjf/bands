#!/bin/bash
# Shared permission library for Slack banded skill scripts.
#
# Source this from every run.sh:
#   SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/../../_lib/slack-perms.sh"

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────

SKILL_ROOT="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHANNEL_CACHE=$(mktemp "${TMPDIR:-/tmp}/slack-channels-XXXXXX")
trap 'rm -f "$CHANNEL_CACHE"' EXIT

# ── Auth ───────────────────────────────────────────────────────────────

if [ -z "${SLACK_BOT_TOKEN:-}" ]; then
  echo '{"error": "SLACK_BOT_TOKEN is not set"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi

# ── Config helpers ─────────────────────────────────────────────────────

# Read a top-level scalar value from the band config JSON.
get_perm() {
  local key="$1"
  jq -r ".$key | select(. != null)" "$CONFIG_PATH"
}

# Read a channel list (allow or deny) from the band config JSON.
get_channel_list() {
  local key="$1"
  jq -r ".channels.$key[]?" "$CONFIG_PATH"
}

# ── Permission error ───────────────────────────────────────────────────

perms_error() {
  local msg="$1"
  echo "{\"error\": \"Permission denied: $msg\"}" > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}

# ── Feature check ─────────────────────────────────────────────────────

check_feature() {
  local feature="$1"
  local value
  value=$(get_perm "$feature")
  if [ "$value" = "false" ]; then
    perms_error "$feature is disabled"
  fi
}

# ── Channel resolution ────────────────────────────────────────────────

# Resolve a channel name or #name to a channel ID.
# Populates a per-execution cache via conversations.list.
resolve_channel_id() {
  local ref="$1"

  # Already an ID (starts with C, G, or D and is alphanumeric)
  if echo "$ref" | grep -qE '^[CGD][A-Z0-9]{8,}$'; then
    echo "$ref"
    return
  fi

  # Strip leading #
  local name="${ref#\#}"

  # Populate cache if empty
  if [ ! -s "$CHANNEL_CACHE" ]; then
    local cursor=""
    while true; do
      local url="https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=200"
      if [ -n "$cursor" ]; then
        url="${url}&cursor=$(printf '%s' "$cursor" | jq -sRr @uri)"
      fi
      local response
      response=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" "$url")

      local ok
      ok=$(echo "$response" | jq -r '.ok')
      if [ "$ok" != "true" ]; then
        local err
        err=$(echo "$response" | jq -r '.error // "unknown"')
        echo "{\"error\": \"Failed to list channels: $err\"}" > "${OUTPUT_PATH:-/dev/stdout}"
        exit 1
      fi

      echo "$response" | jq -r '.channels[]? | "\(.id) \(.name // .user // "")"' >> "$CHANNEL_CACHE"

      cursor=$(echo "$response" | jq -r '.response_metadata.next_cursor // ""')
      if [ -z "$cursor" ]; then
        break
      fi
    done
  fi

  # Look up by name
  local id
  id=$(grep -E " ${name}$" "$CHANNEL_CACHE" | head -1 | awk '{print $1}')
  if [ -z "$id" ]; then
    echo "{\"error\": \"Channel not found: $ref\"}" > "${OUTPUT_PATH:-/dev/stdout}"
    exit 1
  fi
  echo "$id"
}

# ── Channel permission check ──────────────────────────────────────────

# Validate a channel reference against allow/deny lists and DM policy.
# Returns the resolved channel ID on success, exits on failure.
check_channel() {
  local ref="$1"
  local name="${ref#\#}"

  # Check DM permission
  local dm_allowed
  dm_allowed=$(get_perm "dm")
  if [ "$dm_allowed" = "false" ]; then
    if echo "$ref" | grep -qE '^D[A-Z0-9]{8,}$'; then
      perms_error "direct messages are disabled"
    fi
  fi

  # Check deny list
  local deny_list
  deny_list=$(get_channel_list "deny")
  if [ -n "$deny_list" ]; then
    if echo "$deny_list" | grep -qxF "$name"; then
      perms_error "channel #$name is in the deny list"
    fi
  fi

  # Check allow list (empty = all allowed)
  local allow_list
  allow_list=$(get_channel_list "allow")
  if [ -n "$allow_list" ]; then
    if ! echo "$allow_list" | grep -qxF "$name"; then
      perms_error "channel #$name is not in the allow list"
    fi
  fi

  # Resolve to ID
  resolve_channel_id "$ref"
}

# ── Slack API helper ──────────────────────────────────────────────────

# Usage: slack_api <method> [json_body]
# Posts JSON to the Slack Web API. Handles errors and 429 retries.
slack_api() {
  local method="$1"
  local json_body="${2:-{\}}"
  local url="https://slack.com/api/$method"
  local max_retries=3
  local attempt=0
  local response

  while [ $attempt -lt $max_retries ]; do
    response=$(curl -s -X POST \
      -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$json_body" \
      "$url")

    # Check for rate limiting
    local error_type
    error_type=$(echo "$response" | jq -r '.error // ""')

    if [ "$error_type" = "ratelimited" ]; then
      local retry_after
      retry_after=$(echo "$response" | jq -r '.retry_after // 1')
      sleep "$retry_after"
      attempt=$((attempt + 1))
      continue
    fi

    # Check for API error
    local ok
    ok=$(echo "$response" | jq -r '.ok')
    if [ "$ok" != "true" ]; then
      local error_msg
      error_msg=$(echo "$response" | jq -r '.error // "Unknown Slack API error"')
      echo "{\"error\": \"Slack API error ($method): $error_msg\"}" > "${OUTPUT_PATH:-/dev/stdout}"
      exit 1
    fi

    echo "$response"
    return
  done

  echo '{"error": "Rate limited after '"$max_retries"' retries"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
}
