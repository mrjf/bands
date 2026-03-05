#!/bin/bash
# Echo the input back as JSON
INPUT=$(cat "$INPUT_PATH" 2>/dev/null || echo '{}')
echo "$INPUT" > "${OUTPUT_PATH:-/dev/stdout}"
