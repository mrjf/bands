---
name: github
description: Interact with GitHub repositories, issues, pull requests, releases, gists, labels, and CI/CD
allowed-tools: Bash(./scripts/*)
---

# GitHub

Manage GitHub repositories, issues, pull requests, releases, gists, labels, and CI/CD.

**IMPORTANT: You MUST use ONLY the scripts provided below for ALL GitHub operations. Do NOT use `gh`, `curl`, the GitHub API directly, `git` commands that hit the GitHub API, or any other CLI or library. Every GitHub interaction must go through `./scripts/<script-name>`. If a script doesn't exist for what you need, say so — do not work around it.**

Run scripts with `./scripts/<script-name>`, e.g. `./scripts/gist-list --limit=5`. Use `--help` on any script to see its parameters.

## Available scripts

### Issues
- **`issue-list`** — List issues. Input: `repo`, `state`, `labels`, `assignee`, `limit`
- **`issue-create`** — Create an issue. Input: `repo`, `title`, `body`, `labels`, `assignees`, `milestone`
- **`issue-view`** — View issue details. Input: `repo`, `number`, `comments`
- **`issue-comment`** — Comment on an issue. Input: `repo`, `number`, `body`
- **`issue-edit`** — Edit an issue. Input: `repo`, `number`, `title`, `body`, `milestone`, `add_labels`, `remove_labels`, `add_assignees`, `remove_assignees`
- **`issue-close`** — Close an issue. Input: `repo`, `number`, `reason`, `comment`
- **`issue-reopen`** — Reopen an issue. Input: `repo`, `number`, `comment`

### Pull Requests
- **`pr-list`** — List PRs. Input: `repo`, `state`, `base`, `head`, `label`, `limit`
- **`pr-create`** — Create a PR. Input: `repo`, `title`, `body`, `base`, `head`, `draft`, `labels`, `reviewers`, `assignees`, `milestone`
- **`pr-view`** — View PR details. Input: `repo`, `number`, `comments`
- **`pr-diff`** — View PR diff. Input: `repo`, `number`, `name_only`, `patch`
- **`pr-checks`** — View CI checks. Input: `repo`, `number`, `required`
- **`pr-review`** — Review a PR. Input: `repo`, `number`, `event`, `body`
- **`pr-merge`** — Merge a PR. Input: `repo`, `number`, `method`, `delete_branch`
- **`pr-close`** — Close a PR. Input: `repo`, `number`, `comment`, `delete_branch`

### Releases
- **`release-create`** — Create a release. Input: `repo`, `tag`, `title`, `notes`, `draft`, `prerelease`, `target`, `generate_notes`
- **`release-list`** — List releases. Input: `repo`, `limit`
- **`release-view`** — View release details. Input: `repo`, `tag`
- **`release-delete`** — Delete a release. Input: `repo`, `tag`, `cleanup_tag`

### Labels
- **`label-list`** — List labels. Input: `repo`, `limit`
- **`label-create`** — Create a label. Input: `repo`, `name`, `color`, `description`
- **`label-delete`** — Delete a label. Input: `repo`, `name`

### Gists
- **`gist-create`** — Create a gist. Input: `filename`, `content`, `description`, `public`
- **`gist-list`** — List your gists. Input: `limit`, `public`, `secret`
- **`gist-view`** — View gist details. Input: `id`
- **`gist-delete`** — Delete a gist. Input: `id`

### Repository & CI
- **`repo-view`** — View repo metadata. Input: `repo`
- **`run-list`** — List workflow runs. Input: `repo`, `limit`, `workflow`, `status`, `branch`
- **`run-view`** — View a workflow run. Input: `repo`, `run_id`
- **`search`** — Search GitHub. Input: `query`, `type`, `repo`, `limit`
- **`api`** — Make any GitHub API call (REST). Use for any operation not covered by the scripts above, including getting the authenticated user (`endpoint: "user"`). Input: `endpoint`, `method`, `body`, `headers`
