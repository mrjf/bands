---
band: config-skill
icon: ⚙️
description: Skill with band-namespaced config
allow:
  cli:
    - "cat *"
    - "echo *"
execution:
  target: local-lima
config-skill:
  feature-a: true
  feature-b: false
  items:
    - one
    - two
---
