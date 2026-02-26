---
band: firewall-cli-test
icon: 🔒
description: Test band for CLI permission enforcement

allow:
  cli:
    - "echo *"
    - "cat *"
    - "ls *"

deny:
  cli:
    - "rm *"
    - "sudo *"
    - "curl *"
---

# Firewall CLI Test Band

For testing CLI command filtering:
- Allows: echo, cat, ls
- Denies: rm, sudo, curl
