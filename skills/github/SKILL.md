---
name: github
description: Interact with GitHub repositories, issues, pull requests, releases, gists, labels, and CI/CD through the gh CLI with structured JSON I/O
---

# Skill: github

Comprehensive GitHub operations via the `gh` CLI. All scripts accept and return structured JSON, making them suitable for agent-driven workflows.

Authentication is handled via the `GITHUB_TOKEN` environment secret, which `gh` respects automatically.

## Available Scripts

### Issues
- `issue-list` — List issues with filters (state, labels, assignee)
- `issue-create` — Create a new issue with title, body, labels, assignees
- `issue-view` — View full issue details with optional comments
- `issue-comment` — Add a comment to an issue
- `issue-edit` — Edit issue title, body, labels, assignees, milestone
- `issue-close` — Close an issue with reason and optional comment
- `issue-reopen` — Reopen a closed issue

### Pull Requests
- `pr-list` — List pull requests with filters (state, base, head, label)
- `pr-create` — Create a pull request (with draft support)
- `pr-view` — View full PR details with review status and checks
- `pr-diff` — View PR diff (full diff or file names only)
- `pr-checks` — View CI check status for a PR
- `pr-review` — Submit a review on a pull request
- `pr-merge` — Merge a pull request (merge, squash, or rebase)
- `pr-close` — Close a PR without merging

### Releases
- `release-create` — Create a release (with draft, prerelease, auto-notes)
- `release-list` — List releases in a repository
- `release-view` — View release details and assets
- `release-delete` — Delete a release (with optional tag cleanup)

### Labels
- `label-list` — List labels in a repository
- `label-create` — Create a label with name, color, description
- `label-delete` — Delete a label

### Gists
- `gist-create` — Create a gist (public or secret)
- `gist-list` — List your gists
- `gist-view` — View gist details and files
- `gist-delete` — Delete a gist

### Repository & CI
- `repo-view` — View repository metadata
- `run-list` — List GitHub Actions workflow runs
- `run-view` — View details of a specific workflow run
- `search` — Search GitHub for issues, PRs, repos, or code
- `api` — Make raw GitHub API calls
