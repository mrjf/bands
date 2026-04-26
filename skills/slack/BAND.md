---
band: slack
icon: 💬
description: Slack operations via Web API with declarative channel permissions
allow:
  cli:
    - "curl *"
    - "jq *"
  net:
    - "*"
env:
  secrets:
    - SLACK_BOT_TOKEN
    - SLACK_USER_TOKEN
requires:
  secrets:
    - SLACK_BOT_TOKEN
execution:
  target: local-dangerously
slack:
  channels:
    allow: [engineering, executive]
    deny: [executive]
  dm: false
  threads: true
  reactions: true
  files: false
  search: true
---
