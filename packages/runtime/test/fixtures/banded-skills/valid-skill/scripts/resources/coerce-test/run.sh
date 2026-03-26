#!/bin/bash
INPUT=$(cat "$INPUT_PATH" 2>/dev/null || echo '{}')
echo "$INPUT" > "${OUTPUT_PATH:-/dev/stdout}"
