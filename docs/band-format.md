# Band Format

A band is a YAML configuration that defines permissions and constraints for AI agent execution. Deny by default. Constraint is freedom.

Files use `.band.md` or `BAND.md`. YAML frontmatter followed by optional markdown body.

```markdown
---
band: my-band-name
icon: 🔒
description: What this band allows

allow:
  cli:
    - "python *"
  read:
    - "./data/**"
  write:
    - "/tmp/**"

deny:
  cli:
    - "rm -rf *"

limit:
  maxRuntimeMs: 60000
---

# My Band

Optional documentation.
```


## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `band` | string | Unique identifier (lowercase, hyphens allowed) |
| `icon` | emoji | Single emoji |
| `description` | string | Human-readable description |


## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Version number (integer) |
| `url` | string | Delegates to another band by URL |
| `path` | string | Delegates to another band by path |
| `extends` | string[] | Parent bands to inherit from (GitHub URLs) |
| `includes` | string[] | Bands to merge into this one (GitHub URLs) |
| `env` | object | Secrets and variables |
| `provides` | object | Capabilities this band offers |
| `requires` | object | Secrets and network access this band needs |
| `contract` | object | I/O contract (inline JSON Schema or path/URL ref) |


## Band References

A band can delegate to another band via `url` or `path`. When present, the `band`/`icon`/`description` requirement is waived.

```yaml
---
url: https://github.com/acme/bands/tree/main/data-analyst
---
```


## Composition

```yaml
extends:
  - https://github.com/acme/bands/tree/main/base
includes:
  - https://github.com/acme/bands/tree/main/python-tools
```

| Mechanism | Behavior |
|-----------|----------|
| `extends` | Inherits permissions. Child intersected with parent. |
| `includes` | Merges permissions. Union. |


## Environment

```yaml
env:
  secrets:
    - API_KEY
    - DB_PASSWORD
  variables:
    - NODE_ENV=production
    - LOG_LEVEL=info
```

`secrets` are masked in logs. `variables` are not.


## Requires

Bands declare what they need to run.

```yaml
requires:
  secrets:
    - API_KEY
  network:
    egress:
      - api.example.com
```


## Contract

Input/output schemas for validation. Values can be inline JSON Schema or string references (file paths or URLs). Inline schemas are enforced at runtime; string refs are parsed but not yet resolved.

```yaml
contract:
  input: ./schemas/input.json
  output:
    type: object
    properties:
      result:
        type: string
```


## Band-Specific Config

A band can include skill-specific configuration under a key matching the band name. Extracted into `bandConfig` at parse time.

```yaml
band: slack
icon: 💬
description: Slack integration

slack:
  channels:
    allow: [general]
    deny: []
  dm: false
```


## Permission Model

Deny by default. Deny > Allow.

1. Matches `deny` pattern — denied
2. Matches `allow` pattern — allowed
3. No match — denied


### Permission Categories

Four categories. No others.

```yaml
allow:
  cli: []    # Shell commands
  read: []   # Filesystem read paths
  write: []  # Filesystem write paths
  net: []    # Network hosts

deny:
  cli: []
  read: []
  write: []
  net: []
```


## Glob Patterns

| Pattern | Matches |
|---------|---------|
| `*` | Any characters except `/` in paths; any characters in CLI |
| `**` | Any characters including `/` (recursive) |
| `?` | Exactly one character |


### CLI Patterns

`*` matches anything including slashes (for URLs and paths in arguments).

```yaml
allow:
  cli:
    - "python *"
    - "curl -s *"
    - "npm run *"
    - "ls"                 # exact match, no arguments

deny:
  cli:
    - "curl -X POST *"
    - "rm -rf *"
    - "sudo *"
```


### Filesystem Patterns

`**` for recursive matching.

```yaml
allow:
  read:
    - "/tmp/**"
    - "./data/**"
    - "./*.csv"
  write:
    - "/tmp/**"
    - "./output/**"

deny:
  read:
    - "**/.env*"
    - "**/secrets/**"
    - "**/.git/**"
```


### Network Patterns

Match against hostnames.

```yaml
allow:
  net:
    - "*"                  # all hosts
    - "*.github.com"       # github and subdomains
    - "api.example.com"    # specific host

deny:
  net:
    - "*.internal.corp"
    - "localhost"
```


## Resource Limits

```yaml
limit:
  maxRuntimeMs: 60000      # ms or duration string
  maxOutputBytes: 10485760  # bytes or size string
  maxInputBytes: 1048576
```

Human-readable values: `30s`, `5m`, `1h` for duration. `1k`, `10m`, `1g` for bytes.

```yaml
limit:
  maxRuntimeMs: 5m
  maxOutputBytes: 100m
```


## Insist

Required operations. If not performed during execution, the run fails.

```yaml
insist:
  cli:
    - "echo *"
  read:
    - "/tmp/config.json"
  write:
    - "/tmp/output.txt"
  net:
    - "api.example.com"
```

Use cases: audit logging, mandatory config reads, enforced output locations.

Failure response:

```json
{
  "success": false,
  "error": {
    "code": "INSIST_NOT_SATISFIED",
    "message": "Required operations not performed: cli:echo *"
  }
}
```


## Execution Targets

```yaml
execution:
  target: lima             # or: cloudflare
```

| Target | Isolation |
|--------|-----------|
| `lima` | Full (Linux VM via Virtualization.framework) |
| `cloudflare` | Full (V8 isolate) — placeholder, not yet available |

Target-specific configuration:

```yaml
execution:
  target: lima
  lima:
    vmName: bands-executor
    port: 9000

execution:
  target: cloudflare
  cloudflare:
    workerName: my-band
    accountId: abc123
```


## Permission Checking

```typescript
import { checkCliPermission, checkReadPermission, checkWritePermission, checkNetPermission } from "@bands/format";

checkCliPermission("python script.py", allow.cli, deny.cli);
checkReadPermission("/tmp/data.csv", allow.read, deny.read);
checkWritePermission("/tmp/out.txt", allow.write, deny.write);
checkNetPermission("api.github.com", allow.net, deny.net);
```


## Parsing and Exporting

```typescript
import { parseBandMd, exportBandMd } from "@bands/format";

const { document, errors } = parseBandMd(source);
const output = exportBandMd(document);
```


## Validation

The parser validates required fields, emoji format, glob patterns, numeric limits, and unknown keys. Errors are returned but don't prevent parsing — the document remains usable with warnings.


## Complete Example

```yaml
---
band: data-analyst
icon: 📊
description: Data analysis with Python, pandas, and read-only database access

allow:
  read:
    - "/tmp/**"
    - "./data/**"
    - "./*.csv"
    - "./*.json"
    - "./*.parquet"
  write:
    - "/tmp/**"
    - "./output/**"
  net:
    - "*.amazonaws.com"
    - "storage.googleapis.com"
    - "*.blob.core.windows.net"
  cli:
    - "python *"
    - "python3 *"
    - "pip install *"
    - "cat *"
    - "head *"
    - "tail *"
    - "wc *"
    - "jq *"
    - "curl -s *"
    - "psql -c *"

deny:
  read:
    - "**/.env*"
    - "**/secrets/**"
    - "**/.git/**"
  cli:
    - "curl -X POST *"
    - "curl -X PUT *"
    - "curl -X DELETE *"
    - "rm *"
    - "sudo *"

limit:
  maxRuntimeMs: 30m
  maxOutputBytes: 100m
---
```
