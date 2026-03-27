---
name: slack
description: Send messages, manage channels, reactions, and files in Slack with declarative channel-level permissions
allowed-tools: Bash(./scripts/*)
---

# Slack

Send messages, manage channels, reactions, and files in Slack. All operations respect declarative channel-level and feature-level permissions defined in `slack-permissions.yaml`.

**IMPORTANT: You MUST use ONLY the scripts provided below for ALL Slack operations. Do NOT use `curl`, the Slack API directly, any Slack CLI, SDK, or any other tool. Every Slack interaction must go through `./scripts/<script-name>`. If a script doesn't exist for what you need, say so — do not work around it.**

Run scripts with `./scripts/<script-name>`, e.g. `./scripts/channel-list --limit=5`. Use `--help` on any script to see its parameters.

## Permissions

Scripts enforce restrictions from `slack-permissions.yaml` at the skill root before making any API call. This provides application-level authorization on top of Slack API scopes:

- **channels.allow** — If set, ONLY these channels work. Empty means all allowed.
- **channels.deny** — Always blocked. Deny takes precedence over allow.
- **dm** — Direct messages (default: disabled).
- **threads** — Thread replies (default: enabled).
- **reactions** — Adding/removing reactions (default: enabled).
- **files** — File uploads (default: disabled).
- **search** — Message search (default: enabled).

## Available scripts

### Messages
- **`message-send`** — Send a message to a channel. Input: `channel`, `text`, `thread_ts`
- **`message-list`** — List recent messages in a channel. Input: `channel`, `limit`
- **`message-search`** — Search messages. Requires `SLACK_USER_TOKEN`. Input: `query`, `channel`, `limit`

### Channels
- **`channel-list`** — List channels. Input: `types`, `limit`
- **`channel-info`** — Get channel details. Input: `channel`

### Threads
- **`thread-reply`** — Reply to a thread. Input: `channel`, `thread_ts`, `text`

### Reactions
- **`reaction-add`** — Add a reaction to a message. Input: `channel`, `timestamp`, `emoji`
- **`reaction-remove`** — Remove a reaction from a message. Input: `channel`, `timestamp`, `emoji`

### Files
- **`file-upload`** — Upload a file to a channel. Input: `channel`, `filename`, `content`, `title`

## Notes

- `message-search` requires a user token (`xoxp-`), not a bot token. Set `SLACK_USER_TOKEN` for search.
- Channel references accept `#channel-name` or Slack channel IDs (e.g., `C01234ABCDE`).
- Execution target is `local-dangerously` — scripts run on the host machine.
