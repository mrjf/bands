---
name: elevenlabs
description: ElevenLabs text-to-speech, voice management, and sound effects via REST API
allowed-tools: Bash(./scripts/*)
---

# ElevenLabs

Generate speech from text, manage voices, clone voices, and create sound effects using the ElevenLabs REST API.

**IMPORTANT: You MUST use ONLY the scripts provided below for ALL ElevenLabs operations. Do NOT use `curl`, the ElevenLabs API directly, or any other tool. Every interaction must go through `./scripts/<script-name>`. If a script doesn't exist for what you need, say so — do not work around it.**

Run scripts with `./scripts/<script-name>`, e.g. `./scripts/voice-list`. Use `--help` on any script to see its parameters.

## Available scripts

### Text-to-Speech
- **`tts`** — Generate speech from text. Input: `voice_id`, `text`, `model_id`, `output_path`, `stability`, `similarity_boost`

### Voices
- **`voice-list`** — List available voices. Input: (none)
- **`voice-get`** — Get voice details. Input: `voice_id`

### Sound Effects
- **`sfx`** — Generate a sound effect from a text description. Input: `text`, `duration_seconds`, `output_path`

### Account
- **`user-info`** — Get user info and subscription details. Input: (none)

## Notes

- All scripts require `ELEVENLABS_API_KEY` in the environment.
- Audio output defaults to MP3 format.
- Text-to-speech has a 5000 character limit per request.
