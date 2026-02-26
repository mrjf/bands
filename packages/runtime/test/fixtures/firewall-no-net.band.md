---
band: firewall-no-net-test
icon: 🚫
description: Test band with no network access

allow:
  cli:
    - "echo *"
---

# Firewall No Network Test Band

For testing that network is blocked when not explicitly allowed.
No net permissions = no network access.
