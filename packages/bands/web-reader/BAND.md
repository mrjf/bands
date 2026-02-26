---
band: web-reader
icon: 🌐
description: Read-only web access - can fetch URLs but not post data or access local files

allow:
  read:
    - "/tmp/**"
  write:
    - "/tmp/**"
  net:
    - "*"
  cli:
    - "curl -s *"
    - "curl --silent *"
    - "wget -q *"
    - "jq *"
    - "cat *"
    - "head *"
    - "tail *"
    - "grep *"

deny:
  cli:
    - "curl -X POST *"
    - "curl -X PUT *"
    - "curl -X DELETE *"
    - "curl --data *"
    - "curl -d *"

limit:
  maxRuntimeMs: 60s
  maxOutputBytes: 10m
---

# Web Reader Band

Read-only access to the web. Can fetch URLs and process the responses, but cannot:
- POST data or make mutating requests
- Access local filesystem (except /tmp)
- Run arbitrary commands

Ideal for web scraping, API reading, and data fetching tasks.
