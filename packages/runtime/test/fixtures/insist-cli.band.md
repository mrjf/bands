---
band: insist-cli-test
icon: ⚠️
description: Test band that REQUIRES certain CLI commands to be run

allow:
  cli:
    - "echo *"
    - "cat *"
    - "ls *"
  read:
    - "/tmp/**"

insist:
  cli:
    - "echo *"
---

# Insist CLI Test Band

This band REQUIRES that an echo command be run during execution.
If no echo command is executed, the execution should fail.
