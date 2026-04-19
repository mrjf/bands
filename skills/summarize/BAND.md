---
band: summarize
icon: 📝
description: Summarize documents using Claude Code CLI in non-interactive mode
allow:
  cli:
    - "claude *"
    - "jq *"
    - "cat *"
  net:
    - "api.anthropic.com"
env:
  secrets:
    - ANTHROPIC_API_KEY
requires:
  secrets:
    - ANTHROPIC_API_KEY
limit:
  maxRuntimeMs: 120000
  maxCostDollars: 0.50
execution:
  target: local-lima
---
