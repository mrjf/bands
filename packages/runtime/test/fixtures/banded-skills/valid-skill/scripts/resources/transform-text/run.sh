#!/bin/bash
# Transform text to uppercase
INPUT=$(cat "$INPUT_PATH" 2>/dev/null || echo '{}')
echo "$INPUT" | tr '[:lower:]' '[:upper:]' > "${OUTPUT_PATH:-/dev/stdout}"
