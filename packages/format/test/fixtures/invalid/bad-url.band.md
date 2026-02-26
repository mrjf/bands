---
band: bad-urls
version: 1
icon: "\U0001F6AB"
extends:
  - not-a-github-url
schemas:
  input:
    ref: also-not-a-url
  output:
    ref: https://example.com/not-github
---
