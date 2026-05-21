---
band: github
icon: 🐙
description: GitHub operations via gh CLI with structured JSON I/O
allow:
  cli:
    - "gh *"
    - "git *"
    - "jq *"
  net:
    - "api.github.com"
    - "*.githubusercontent.com"
    - "uploads.github.com"
env:
  secrets:
    - GITHUB_TOKEN
requires:
  secrets:
    - GITHUB_TOKEN
execution:
  target: local-lima
---
