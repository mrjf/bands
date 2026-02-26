---
band: firewall-fs-test
icon: 📁
description: Test band for filesystem permission enforcement

allow:
  read:
    - "/tmp/**"
    - "./allowed/**"
  write:
    - "/tmp/output/**"

deny:
  read:
    - "**/.env*"
    - "**/secrets/**"
  write:
    - "/etc/**"
    - "/usr/**"
---

# Firewall Filesystem Test Band

For testing filesystem access control:
- Read allowed: /tmp/**, ./allowed/**
- Read denied: .env files, secrets directories
- Write allowed: /tmp/output/**
- Write denied: /etc/**, /usr/**
