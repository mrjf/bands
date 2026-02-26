---
band: secure-coding-assistant
version: 1
icon: 🛡️
description: A coding assistant with restricted capabilities, extending a base coder
extends:
  - https://github.com/acme/bands/tree/main/base-coder
includes:
  - https://github.com/acme/bands/tree/main/linter-adapter
  - https://github.com/acme/bands/tree/main/test-runner-adapter
schemas:
  input:
    ref: https://github.com/acme/schemas/blob/main/code-input.json
  output:
    ref: https://github.com/acme/schemas/blob/main/code-output.json
returns:
  supports:
    - sync
    - stream
  default: stream
capabilities:
  tools:
    default: deny
    allow:
      - https://github.com/acme/tools/tree/main/code-search
      - https://github.com/acme/tools/tree/main/file-editor
    deny:
      - https://github.com/acme/tools/tree/main/shell-exec
      - https://github.com/acme/tools/tree/main/network-fetch
    insist:
      - https://github.com/acme/tools/tree/main/security-scanner
  skills:
    allow:
      - https://github.com/acme/skills/tree/main/code-review
      - kind: local
        ref: ./skills/style-checker
  filesystem:
    default: deny
    allow:
      - "*.ts"
      - "*.js"
      - "*.json"
      - "*.md"
    deny:
      - ".env"
      - "*.key"
      - "*.pem"
  network:
    egress:
      default: deny
      allow_dns:
        - registry.npmjs.org
        - api.github.com
limits:
  maxInputBytes: 1048576
  maxOutputBytes: 5242880
  maxRuntimeMs: 120000
---
