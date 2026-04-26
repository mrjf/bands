---
band: elevenlabs
icon: 🔊
description: ElevenLabs text-to-speech, voice management, and sound effects via REST API
allow:
  cli:
    - "curl *"
    - "jq *"
  net:
    - "*"
env:
  secrets:
    - ELEVENLABS_API_KEY
requires:
  secrets:
    - ELEVENLABS_API_KEY
execution:
  target: local-lima
---
