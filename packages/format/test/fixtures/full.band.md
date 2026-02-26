---
band: full-band
version: 2
icon: "\U0001F680"
description: A fully featured band example
extends:
  - https://github.com/acme/bands/tree/main/base
includes:
  - https://github.com/acme/bands/tree/main/github-adapter
schemas:
  input:
    ref: https://github.com/acme/schemas/blob/main/input.json
  output:
    ref: https://github.com/acme/schemas/blob/main/output.json
  streamChunk:
    ref: https://github.com/acme/schemas/blob/main/chunk.json
returns:
  supports:
    - sync
    - stream
    - async
  default: sync
  sync:
    schema: schemas.output
  stream:
    finalSchema: schemas.output
    chunkSchema: schemas.streamChunk
  async:
    schema: schemas.output
capabilities:
  tools:
    default: deny
    allow:
      - https://github.com/acme/tools/tree/main/search
      - https://github.com/acme/tools/tree/main/calculator
    deny:
      - https://github.com/acme/tools/tree/main/dangerous
    insist:
      - https://github.com/acme/tools/tree/main/logging
  skills:
    allow:
      - https://github.com/acme/skills/tree/main/summarize
      - kind: local
        ref: ./skills/custom-skill
    deny:
      - https://github.com/acme/skills/tree/main/banned-skill
  mcps:
    allow:
      - https://github.com/acme/mcps/tree/main/memory
  apis:
    allow:
      - https://github.com/acme/api-adapters/tree/main/github
  filesystem:
    default: deny
    allow:
      - "*.txt"
      - op: read
        paths:
          - /tmp/**
          - /data/**
  network:
    egress:
      default: deny
      allow_dns:
        - "*.example.com"
        - api.github.com
      allow_ip:
        - 10.0.0.0/8
      deny_ip:
        - 0.0.0.0/0
limits:
  maxInputBytes: 1048576
  maxOutputBytes: 5242880
  maxRuntimeMs: 30000
  maxAsyncDurationMs: 300000
  maxStreamItems: 1000
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
---

# Full Band

This is an example band with all features.
