#!/bin/bash
# Echo the input message back as JSON
# Reads from $INPUT_PATH, writes to $OUTPUT_PATH

INPUT=$(cat "$INPUT_PATH" 2>/dev/null || echo '{}')

# Extract message field and echo it back
MESSAGE=$(echo "$INPUT" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$MESSAGE" ]; then
  echo '{"echo": "no message provided"}' > "${OUTPUT_PATH:-/dev/stdout}"
else
  echo "{\"echo\": \"$MESSAGE\"}" > "${OUTPUT_PATH:-/dev/stdout}"
fi
