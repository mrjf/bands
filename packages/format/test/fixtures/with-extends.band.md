---
band: child-band
version: 1
icon: "\U0001F476"
extends:
  - https://github.com/acme/bands/tree/main/parent
capabilities:
  tools:
    allow:
      - https://github.com/acme/tools/tree/main/search
    deny:
      - https://github.com/acme/tools/tree/main/dangerous
returns:
  supports:
    - sync
    - stream
  default: sync
---
