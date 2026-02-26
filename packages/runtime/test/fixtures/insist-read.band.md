---
band: insist-read-test
icon: 📖
description: Test band that REQUIRES certain files to be read

allow:
  read:
    - "/tmp/**"
    - "./data/**"

insist:
  read:
    - "/tmp/required.txt"
---

# Insist Read Test Band

This band REQUIRES that /tmp/required.txt be read during execution.
If the file is not read, the execution should fail.
