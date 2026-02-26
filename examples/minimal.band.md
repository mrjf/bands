---
band: hello-world
version: 1
icon: 👋
description: The simplest possible band
schemas:
  input:
    ref: https://github.com/acme/schemas/blob/main/text-input.json
  output:
    ref: https://github.com/acme/schemas/blob/main/text-output.json
returns:
  supports:
    - sync
  default: sync
---
