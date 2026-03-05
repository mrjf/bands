---
band: github
icon: 🐙
description: GitHub operations via gh CLI with structured JSON I/O
allow:
  cli:
    - "gh *"
    - "jq *"
  net:
    - api.github.com
    - github.com
    - gist.github.com
env:
  secrets:
    - GITHUB_TOKEN
requires:
  secrets:
    - GITHUB_TOKEN
execution:
  target: lima
---
