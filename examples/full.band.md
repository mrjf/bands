---
band: research-agent
version: 3
icon: 🔬
description: A research agent with web search, file access, and streaming output
extends:
  - https://github.com/acme/bands/tree/main/base-agent
includes:
  - https://github.com/acme/bands/tree/main/github-adapter
schemas:
  input:
    ref: https://github.com/acme/schemas/blob/main/research-input.json
  output:
    ref: https://github.com/acme/schemas/blob/main/research-output.json
  streamChunk:
    ref: https://github.com/acme/schemas/blob/main/research-chunk.json
returns:
  supports:
    - sync
    - stream
    - async
  default: stream
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
      - https://github.com/acme/tools/tree/main/web-search
      - https://github.com/acme/tools/tree/main/calculator
      - https://github.com/acme/tools/tree/main/citation-manager
    insist:
      - https://github.com/acme/tools/tree/main/audit-logger
  skills:
    allow:
      - https://github.com/acme/skills/tree/main/summarize
      - https://github.com/acme/skills/tree/main/extract-entities
      - kind: local
        ref: ./skills/domain-classifier
    deny:
      - https://github.com/acme/skills/tree/main/code-execution
  mcps:
    allow:
      - https://github.com/acme/mcps/tree/main/long-term-memory
  apis:
    allow:
      - https://github.com/acme/api-adapters/tree/main/github
      - https://github.com/acme/api-adapters/tree/main/arxiv
  filesystem:
    default: deny
    allow:
      - "*.md"
      - "*.txt"
      - "*.json"
      - op: read
        paths:
          - /data/research/**
          - /tmp/workspace/**
  network:
    egress:
      default: deny
      allow_dns:
        - "*.github.com"
        - "*.arxiv.org"
        - api.semanticscholar.org
      allow_ip:
        - 10.0.0.0/8
      deny_ip:
        - 0.0.0.0/0
limits:
  maxInputBytes: 2097152
  maxOutputBytes: 10485760
  maxRuntimeMs: 60000
  maxAsyncDurationMs: 600000
  maxStreamItems: 5000
provides:
  apis:
    - github-rest
    - arxiv-search
  tools:
    - web-search
    - citation-manager
requires:
  secrets:
    - GITHUB_TOKEN
    - ARXIV_API_KEY
  network:
    egress:
      - "*.github.com"
      - "*.arxiv.org"
---

# Research Agent

A multi-modal research agent that can search the web, access academic papers,
and produce structured research outputs with citations.

## Usage

This band is designed to be used for deep research tasks that require
searching multiple sources and synthesizing findings.
