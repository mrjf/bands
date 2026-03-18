---
band: secure-coding-assistant
version: 1
icon: "\U0001F6E1\uFE0F"
description: A coding assistant with restricted capabilities, extending a base coder
extends:
  - https://github.com/acme/bands/tree/main/base-coder
includes:
  - https://github.com/acme/bands/tree/main/linter-adapter
  - https://github.com/acme/bands/tree/main/test-runner-adapter
allow:
  tools:
    - https://github.com/acme/tools/tree/main/code-search
    - https://github.com/acme/tools/tree/main/file-editor
  skills:
    - https://github.com/acme/skills/tree/main/code-review
    - kind: local
      ref: ./skills/style-checker
  read:
    - "*.ts"
    - "*.js"
    - "*.json"
    - "*.md"
  write:
    - "*.ts"
    - "*.js"
    - "*.json"
    - "*.md"
  net:
    - registry.npmjs.org
    - api.github.com
deny:
  tools:
    - https://github.com/acme/tools/tree/main/shell-exec
    - https://github.com/acme/tools/tree/main/network-fetch
  read:
    - ".env"
    - "*.key"
    - "*.pem"
  write:
    - ".env"
    - "*.key"
    - "*.pem"
insist:
  tools:
    - https://github.com/acme/tools/tree/main/security-scanner
limit:
  maxInputBytes: 1048576
  maxOutputBytes: 5242880
  maxRuntimeMs: 120000
contract:
  input: https://github.com/acme/schemas/blob/main/code-input.json
  output: https://github.com/acme/schemas/blob/main/code-output.json
---
