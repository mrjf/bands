---
band: insist-write-test
icon: ✏️
description: Test band requiring file writes

allow:
  write:
    - "/tmp/output/**"
  read:
    - "/tmp/**"

insist:
  write:
    - "/tmp/output/required.txt"
---

# Insist Write Test Band

This band REQUIRES that `/tmp/output/required.txt` be written during execution.
If the file is not written, the execution should fail.
