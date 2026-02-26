---
band: insist-net-test
icon: 🌐
description: Test band that REQUIRES certain network calls

allow:
  net:
    - "api.github.com"
    - "httpbin.org"

insist:
  net:
    - "httpbin.org"
---

# Insist Network Test Band

This band REQUIRES that httpbin.org be accessed during execution.
If no request to httpbin.org is made, the execution should fail.
