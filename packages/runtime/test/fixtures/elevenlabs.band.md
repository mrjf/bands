---
band: elevenlabs-integration-test
icon: 🔊
description: Test band for ElevenLabs API integration testing

env:
  secrets:
    - ELEVENLABS_API_KEY

allow:
  cli:
    - "curl *"
    - "echo *"
    - "ls *"
    - "file *"
    - "cat *"
  read:
    - /tmp/**
    - ./**
  write:
    - /tmp/**
  net:
    - api.elevenlabs.io

requires:
  secrets:
    - ELEVENLABS_API_KEY
  network:
    egress:
      - api.elevenlabs.io
---

# ElevenLabs Integration Test Band

Test band for verifying ElevenLabs API connectivity and operations.
Requires ELEVENLABS_API_KEY in environment or .env file.
