---
band: summarize
icon: 📝
description: Summarize documents using Claude Code CLI in non-interactive mode
allow:
  cli:
    - "claude *"
    - "curl *"
    - "jq *"
    - "cat *"
  net:
    - "api.anthropic.com"
insist:
  cli:
    - "claude *"
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
