---
band: full-band
version: 2
icon: "\U0001F680"
description: A fully featured band example
extends:
  - https://github.com/acme/bands/tree/main/base
includes:
  - https://github.com/acme/bands/tree/main/github-adapter
allow:
  tools:
    - https://github.com/acme/tools/tree/main/search
    - https://github.com/acme/tools/tree/main/calculator
  skills:
    - https://github.com/acme/skills/tree/main/summarize
    - kind: local
      ref: ./skills/custom-skill
  mcps:
    - https://github.com/acme/mcps/tree/main/memory
  apis:
    - https://github.com/acme/api-adapters/tree/main/github
  read:
    - "*.txt"
    - /tmp/**
    - /data/**
  write:
    - "*.txt"
  net:
    - "*.example.com"
    - api.github.com
deny:
  tools:
    - https://github.com/acme/tools/tree/main/dangerous
  skills:
    - https://github.com/acme/skills/tree/main/banned-skill
insist:
  tools:
    - https://github.com/acme/tools/tree/main/logging
limit:
  maxInputBytes: 1048576
  maxOutputBytes: 5242880
  maxRuntimeMs: 30000
provides:
  apis:
    - github-rest
  tools:
    - search
requires:
  secrets:
    - GITHUB_TOKEN
  network:
    egress:
      - api.github.com
contract:
  input: https://github.com/acme/schemas/blob/main/input.json
  output: https://github.com/acme/schemas/blob/main/output.json
---

# Full Band

This is an example band with all features.
