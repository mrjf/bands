---
band: code-runner
icon: ⚡
description: Run code in isolated environment - Python, Node, with no network

allow:
  read:
    - "/tmp/**"
    - "./src/**"
    - "./scripts/**"
    - "./*.py"
    - "./*.js"
    - "./*.ts"
  write:
    - "/tmp/**"
    - "./output/**"
  cli:
    - "python *"
    - "python3 *"
    - "node *"
    - "bun *"
    - "deno *"
    - "cat *"
    - "ls *"
    - "echo *"
    - "jq *"

deny:
  cli:
    - "rm -rf *"
    - "sudo *"
    - "chmod *"
    - "chown *"

limit:
  maxRuntimeMs: 5m
  maxOutputBytes: 10m
---

# Code Runner Band

Execute code in Python, Node.js, Bun, or Deno with filesystem access but no network.

Safe for running untrusted code snippets since:
- No network access
- Filesystem limited to /tmp and source directories
- Destructive commands blocked
