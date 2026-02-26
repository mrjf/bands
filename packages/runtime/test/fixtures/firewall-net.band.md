---
band: firewall-net-test
icon: 🌐
description: Test band for network permission enforcement

allow:
  net:
    - "*.github.com"
    - "httpbin.org"

deny:
  net:
    - "*.internal.corp"
    - "localhost"
---

# Firewall Network Test Band

For testing network egress control:
- Allowed: *.github.com, httpbin.org
- Denied: *.internal.corp, localhost
