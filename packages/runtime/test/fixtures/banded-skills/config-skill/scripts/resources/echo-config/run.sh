#!/bin/bash
# Echo the config back as output
if [ -n "${CONFIG_PATH:-}" ] && [ -f "$CONFIG_PATH" ]; then
  cat "$CONFIG_PATH" > "${OUTPUT_PATH:-/dev/stdout}"
else
  echo '{"error": "CONFIG_PATH not set or file missing"}' > "${OUTPUT_PATH:-/dev/stdout}"
  exit 1
fi
