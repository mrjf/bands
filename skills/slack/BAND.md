---
band: slack
icon: 💬
description: Slack operations via Web API with declarative channel permissions
allow:
  cli:
    - "curl *"
    - "jq *"
  net:
    - "slack.com"
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
    allow: []
    deny: []
  dm: false
  threads: false
  reactions: false
  files: false
  search: false
---
