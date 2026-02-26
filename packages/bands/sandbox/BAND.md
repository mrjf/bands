---
band: sandbox
icon: 📦
description: Maximum isolation - no network, no filesystem outside /tmp, minimal CLI

allow:
  read:
    - "/tmp/**"
  write:
    - "/tmp/**"
  cli:
    - "echo *"
    - "cat *"
    - "ls *"
    - "head *"
    - "tail *"
    - "wc *"
    - "sort *"
    - "uniq *"
    - "grep *"
    - "jq *"

limit:
  maxRuntimeMs: 30s
  maxOutputBytes: 1m
---

# Sandbox Band

A fully isolated environment for running untrusted code. No network access, filesystem limited to `/tmp`, and only basic unix utilities available.

Use this band when you need to run code from an untrusted source or want maximum isolation.
