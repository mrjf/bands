---
band: codemod
version: 1
icon: "\U0001F527"
description: Automated code transformations across codebases. Use this skill when users want to rename functions,
  variables, or types across files, migrate API usage patterns, update import paths, convert between code styles
  (e.g. callbacks to async/await, class components to hooks), apply consistent formatting changes, or perform any
  repetitive code modification that spans multiple files. Triggers on requests like "rename X to Y everywhere",
  "migrate from old API to new API", "convert all X to Y", or "refactor across the codebase".
allow:
  tools:
    - claude:bash
    - claude:read
    - claude:write
    - claude:edit
    - claude:glob
    - claude:grep
  read:
    - "**/*"
  write:
    - "**/*"
  net:
    - registry.npmjs.org
    - pypi.org
limit:
  maxInputBytes: 1048576
  maxOutputBytes: 10485760
  maxRuntimeMs: 60000
execution:
  target: local-lima
---
