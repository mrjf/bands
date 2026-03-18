---
band: research-agent
version: 3
icon: "\U0001F52C"
description: A research agent with web search, file access, and streaming output
extends:
  - https://github.com/acme/bands/tree/main/base-agent
includes:
  - https://github.com/acme/bands/tree/main/github-adapter
allow:
  tools:
    - https://github.com/acme/tools/tree/main/web-search
    - https://github.com/acme/tools/tree/main/calculator
    - https://github.com/acme/tools/tree/main/citation-manager
  skills:
    - https://github.com/acme/skills/tree/main/summarize
    - https://github.com/acme/skills/tree/main/extract-entities
    - kind: local
      ref: ./skills/domain-classifier
  mcps:
    - https://github.com/acme/mcps/tree/main/long-term-memory
  apis:
    - https://github.com/acme/api-adapters/tree/main/github
    - https://github.com/acme/api-adapters/tree/main/arxiv
  read:
    - "*.md"
    - "*.txt"
    - "*.json"
    - /data/research/**
    - /tmp/workspace/**
  write:
    - "*.md"
    - "*.txt"
    - "*.json"
  net:
    - "*.github.com"
    - "*.arxiv.org"
    - api.semanticscholar.org
deny:
  skills:
    - https://github.com/acme/skills/tree/main/code-execution
insist:
  tools:
    - https://github.com/acme/tools/tree/main/audit-logger
limit:
  maxInputBytes: 2097152
  maxOutputBytes: 10485760
  maxRuntimeMs: 60000
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
contract:
  input: https://github.com/acme/schemas/blob/main/research-input.json
  output: https://github.com/acme/schemas/blob/main/research-output.json
---

# Research Agent

A multi-modal research agent that can search the web, access academic papers,
and produce structured research outputs with citations.

## Usage

This band is designed to be used for deep research tasks that require
searching multiple sources and synthesizing findings.
