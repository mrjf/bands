---
band: elevenlabs
version: 1
icon: 🔊
description: Interact with the ElevenLabs API for text-to-speech synthesis, voice management, voice cloning, and sound
  effect generation. Use when users need to generate audio from text, manage or clone voices, or create sound effects
  using ElevenLabs.
returns:
  default: sync
  supports:
    - sync
capabilities:
  tools:
    default: deny
    allow:
      - claude:bash
      - claude:glob
      - claude:read
      - claude:write
  filesystem:
    default: deny
    allow:
      - read:**/*
      - write:**/*
  network:
    egress:
      default: deny
      allow_dns:
        - api.elevenlabs.io
limits:
  maxInputBytes: 1048576
  maxOutputBytes: 10485760
  maxRuntimeMs: 30000
execution:
  target: local-docker
env:
  secrets:
    - ELEVENLABS_API_KEY
requires:
  secrets:
    - ELEVENLABS_API_KEY
  network:
    egress:
      - api.elevenlabs.io
---

# Skill: elevenlabs

Interact with the ElevenLabs API for text-to-speech synthesis, voice management, voice cloning, and sound effect generation. Use when users need to generate audio from text, manage or clone voices, or create sound effects using ElevenLabs.

## Instructions

# ElevenLabs API Integration Guide

## Overview

Use the ElevenLabs API to generate high-quality speech from text, manage voices, clone voices from audio samples, and generate sound effects. All interactions use the ElevenLabs REST API via `curl`.

**Keywords**: text-to-speech, TTS, voice synthesis, voice cloning, audio generation, sound effects, ElevenLabs, speech generation

---

## Authentication

All requests require the `xi-api-key` header:

```bash
curl -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/...
```

Verify the API key is set before making any requests:

```bash
if [ -z "$ELEVENLABS_API_KEY" ]; then
  echo "Error: ELEVENLABS_API_KEY is not set."
  exit 1
fi
```

---

## Core Capabilities

### 1. Text-to-Speech

Generate speech audio from text input.

**Basic request:**

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75
    }
  }' \
  --output output.mp3
```

**Key parameters:**
- `voice_id` (path) — Target voice identifier (obtain from voice list)
- `text` (body) — Text to synthesize (max 5000 characters per request)
- `model_id` (body) — Model to use:
  - `eleven_multilingual_v2` — Best quality, supports 29 languages
  - `eleven_turbo_v2_5` — Low latency, good quality
  - `eleven_turbo_v2` — Lowest latency, English-optimized
- `voice_settings.stability` (0.0–1.0) — Higher values produce more consistent output
- `voice_settings.similarity_boost` (0.0–1.0) — Higher values make output closer to original voice
- `output_format` (query param) — `mp3_44100_128` (default), `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100`, `ulaw_8000`

**With streaming:**

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Streamed audio content.",
    "model_id": "eleven_multilingual_v2"
  }' \
  --output stream_output.mp3
```

### 2. Voice Management

**List available voices:**

```bash
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices"
```

**Get voice details:**

```bash
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices/{voice_id}"
```

**Get default voice settings:**

```bash
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices/settings/default"
```

### 3. Voice Cloning

Clone a voice from audio samples using the add-voice endpoint.

**Instant voice clone:**

```bash
curl -X POST "https://api.elevenlabs.io/v1/voices/add" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F "name=My Cloned Voice" \
  -F "description=A cloned voice from sample audio" \
  -F "files=@sample1.mp3" \
  -F "files=@sample2.mp3"
```

**Requirements:**
- Provide 1–25 audio samples
- Samples should be clean speech with minimal background noise
- Supported formats: mp3, wav, m4a, ogg, flac
- Each sample should be at least 1 second long

**Delete a cloned voice:**

```bash
curl -X DELETE "https://api.elevenlabs.io/v1/voices/{voice_id}" \
  -H "xi-api-key: $ELEVENLABS_API_KEY"
```

### 4. Sound Effects Generation

Generate sound effects from a text description.

```bash
curl -X POST "https://api.elevenlabs.io/v1/sound-generation" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Gentle rain falling on a tin roof",
    "duration_seconds": 5.0
  }' \
  --output rain_sound.mp3
```

**Parameters:**
- `text` — Description of the desired sound effect
- `duration_seconds` (optional) — Length of audio to generate (0.5–22.0 seconds)

### 5. Speech-to-Speech

Transform speech from one voice to another while preserving the delivery style.

```bash
curl -X POST "https://api.elevenlabs.io/v1/speech-to-speech/{voice_id}" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F "audio=@input_speech.mp3" \
  -F "model_id=eleven_english_sts_v2" \
  --output transformed.mp3
```

### 6. Audio Isolation

Remove background noise from audio.

```bash
curl -X POST "https://api.elevenlabs.io/v1/audio-isolation" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F "audio=@noisy_audio.mp3" \
  --output clean_audio.mp3
```

### 7. Models

**List available models:**

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/models"
```

Returns an array of model objects with `model_id`, `name`, `description`, and `languages`.

### 8. User and Subscription

**Get user info:**

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/user"
```

**Get subscription details and character usage:**

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/user/subscription"
```

Returns `character_count`, `character_limit`, `tier`, and other quota information.

### 9. Generation History

**List generation history:**

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/history?page_size=20"
```

**Get a specific history item:**

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/history/{history_item_id}"
```

**Download audio from a history item:**

```bash
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/history/{history_item_id}/audio" \
  --output history_audio.mp3
```

**Delete a history item:**

```bash
curl -X DELETE "https://api.elevenlabs.io/v1/history/{history_item_id}" \
  -H "xi-api-key: $ELEVENLABS_API_KEY"
```

---

## Workflow

### Step 1: Discover Voices

Always start by listing available voices to find appropriate voice IDs:

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/voices" | python3 -m json.tool
```

Parse the response to extract `voice_id` and `name` fields for use in subsequent calls.

### Step 2: Check Subscription Quota

Before generating large amounts of audio, check remaining character quota:

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/user/subscription" | python3 -m json.tool
```

### Step 3: Generate Audio

Use the appropriate endpoint based on the task (TTS, sound effects, speech-to-speech, etc.).

### Step 4: Verify Output

Confirm the output file was created and has a reasonable size:

```bash
ls -lh output.mp3
file output.mp3
```

---

## Best Practices

- **Check quota first** — Verify character limits before bulk generation to avoid unexpected failures
- **Use appropriate models** — Choose `eleven_multilingual_v2` for quality, `eleven_turbo_v2_5` for speed
- **Tune voice settings** — Start with stability=0.5 and similarity_boost=0.75, then adjust
- **Handle errors** — Check HTTP status codes; 401 means invalid API key, 429 means rate limited
- **Batch long text** — Split text longer than 5000 characters into chunks and concatenate the resulting audio files
- **Use streaming for playback** — Use the `/stream` endpoint when audio will be played back in real time
- **Clean audio for cloning** — Voice clone quality depends heavily on input sample quality

## Error Handling

| Status Code | Meaning | Action |
|---|---|---|
| 401 | Invalid API key | Verify `ELEVENLABS_API_KEY` is set correctly |
| 422 | Validation error | Check request body and parameters |
| 429 | Rate limited | Wait and retry with exponential backoff |
| 500 | Server error | Retry after a brief delay |
