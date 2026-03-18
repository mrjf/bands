# Band Format Specification

A **Band** is a YAML-based configuration that defines permissions and constraints for AI agent execution. Bands act as sandboxes, controlling what an agent can access: CLI commands, filesystem paths, network hosts, and resource limits.

## File Format

Band files use the `.band.md` or `BAND.md` extension. They consist of YAML frontmatter followed by optional markdown documentation:

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

Optional markdown documentation about this band.
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `band` | string | Unique identifier (lowercase, hyphens allowed) |
| `icon` | emoji | Single emoji representing the band |
| `description` | string | Human-readable description |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Version number (integer) |
| `url` | string | Band reference URL (delegates to another band) |
| `path` | string | Band reference path (delegates to another band) |
| `extends` | string[] | Parent bands to inherit from (GitHub URLs) |
| `includes` | string[] | Bands to merge into this one (GitHub URLs) |
| `env` | object | Environment configuration (secrets and variables) |
| `provides` | object | APIs, tools, skills, and MCPs this band offers |
| `requires` | object | Secrets and network access this band needs |
| `contract` | object | I/O contract (inline JSON Schema or path/URL ref) |

### Band References

A band can delegate to another band via `url` or `path`. When present, the required field check for `band`/`icon`/`description` is skipped — the referenced band provides them.

```yaml
---
url: https://github.com/acme/bands/tree/main/data-analyst
---
```

### Composition

Bands support inheritance (`extends`) and merging (`includes`):

```yaml
extends:
  - https://github.com/acme/bands/tree/main/base
includes:
  - https://github.com/acme/bands/tree/main/python-tools
```

- `extends`: Parent bands whose permissions this band inherits. Child permissions are intersected with parent permissions.
- `includes`: Bands whose permissions are merged (unioned) into this band.

### Environment

The `env` field configures secrets and variables passed to the execution environment:

```yaml
env:
  secrets:
    - API_KEY
    - DB_PASSWORD
  variables:
    - NODE_ENV=production
    - LOG_LEVEL=info
```

- `secrets`: Sensitive values (masked in logs). Fetched from the running environment or `.env` file.
- `variables`: Non-sensitive environment variables.

### Provides & Requires

Bands can declare what they offer and what they need:

```yaml
provides:
  apis:
    - https://github.com/acme/apis/tree/main/search
  tools:
    - https://github.com/acme/tools/tree/main/formatter
  skills:
    - https://github.com/acme/skills/tree/main/summarize
  mcps:
    - https://github.com/acme/mcps/tree/main/memory

requires:
  secrets:
    - API_KEY
  network:
    egress:
      - api.example.com
```

### Contract

The `contract` field defines input/output schemas for validation. Values can be inline JSON Schema objects or string references (file paths or URLs). Inline schemas are enforced at runtime; string refs are parsed and stored but not yet resolved (see `docs/TODO.md`).

```yaml
contract:
  input: ./schemas/input.json
  output:
    type: object
    properties:
      result:
        type: string
```

### Band-Specific Config

A band can include skill-specific configuration under a key matching the band name. This is extracted into the `bandConfig` field at parse time:

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

Bands use a **deny-by-default** permission model:

- If something isn't in `allow`, it's denied
- `deny` patterns punch holes in `allow` patterns
- `deny` takes precedence over `allow`

### Permission Categories

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

All permission patterns use glob syntax:

| Pattern | Matches |
|---------|---------|
| `*` | Any characters except `/` in paths; any characters in CLI commands |
| `**` | Any characters including `/` (recursive) |
| `?` | Exactly one character |

### CLI Patterns

CLI patterns match against the full command string. The `*` wildcard matches anything including slashes (for URLs and paths in arguments):

```yaml
allow:
  cli:
    - "python *"           # python with any arguments
    - "python3 *"          # python3 with any arguments
    - "curl -s *"          # curl with -s flag and any URL
    - "npm run *"          # npm run with any script name
    - "ls"                 # exact match, no arguments

deny:
  cli:
    - "curl -X POST *"     # block POST requests
    - "rm -rf *"           # block recursive force delete
    - "sudo *"             # block all sudo commands
```

### Filesystem Patterns

Read and write patterns use `**` for recursive matching:

```yaml
allow:
  read:
    - "/tmp/**"            # anything under /tmp
    - "./data/**"          # anything under ./data
    - "./*.csv"            # CSV files in current directory
    - "./*.json"           # JSON files in current directory

  write:
    - "/tmp/**"            # can write anywhere under /tmp
    - "./output/**"        # can write to output directory

deny:
  read:
    - "**/.env*"           # block all .env files
    - "**/secrets/**"      # block secrets directories
    - "**/.git/**"         # block git internals
```

### Network Patterns

Network patterns match against hostnames:

```yaml
allow:
  net:
    - "*"                  # allow all hosts
    - "*.github.com"       # github and subdomains
    - "api.example.com"    # specific host

deny:
  net:
    - "*.internal.corp"    # block internal domains
    - "localhost"          # block localhost
```

## Resource Limits

```yaml
limit:
  maxRuntimeMs: 60000      # Maximum execution time (ms or duration string)
  maxOutputBytes: 10485760 # Maximum output size in bytes (or size string)
  maxInputBytes: 1048576   # Maximum input size in bytes
```

### Human-Readable Values

Limits support human-readable strings:

**Duration:** `30s`, `5m`, `1h`
**Bytes:** `1k`, `10m`, `1g` (case-insensitive)

```yaml
limit:
  maxRuntimeMs: 5m         # 5 minutes
  maxOutputBytes: 100m     # 100 megabytes
```

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

# Data Analyst Band

For data analysis tasks with Python. Includes:
- Read access to data files (CSV, JSON, Parquet)
- Network access to cloud storage (S3, GCS, Azure)
- Read-only database queries
- Python with pip for installing packages

Blocks:
- Mutating HTTP requests (POST, PUT, DELETE)
- Access to secrets and .env files
- Destructive file operations
```

## Insist (Required Operations)

The `insist` section defines operations that **must** be performed during execution. If these requirements aren't met, the execution fails.

```yaml
insist:
  cli:
    - "echo *"              # Must run at least one echo command
  read:
    - "/tmp/config.json"    # Must read this file
  write:
    - "/tmp/output.txt"     # Must write to this file
  net:
    - "api.example.com"     # Must make a request to this host
```

Use cases:
- Ensure audit logging (`insist.cli: ["echo AUDIT:*"]`)
- Require reading a config file before proceeding
- Enforce that results are written to a specific location

If insist requirements aren't satisfied, sandboxed executors return:
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

Bands can specify where they should run:

```yaml
execution:
  target: cloudflare       # or: local-lima, local-dangerously
```

| Target | Description | Isolation |
|--------|-------------|-----------|
| `local-dangerously` | Runs in current process | None (dev only) |
| `local-lima` | Lima VM on macOS | Full (Linux VM) |
| `cloudflare` | Cloudflare Workers | Full (V8 isolate) |

Target-specific configuration:

```yaml
execution:
  target: local-lima
  lima:
    vmName: bands-executor    # VM name (default: bands-executor)
    port: 9000                # Server port (default: 9000)

execution:
  target: cloudflare
  cloudflare:
    workerName: my-band       # Worker name
    accountId: abc123         # Cloudflare account ID
```

## Permission Checking

When a command or path is checked:

1. Check if it matches any `deny` pattern → **DENIED**
2. Check if it matches any `allow` pattern → **ALLOWED**
3. No match → **DENIED** (deny by default)

```typescript
import { checkCliPermission, checkReadPermission, checkWritePermission, checkNetPermission } from "@bands/format";

// Check CLI command
checkCliPermission("python script.py", allow.cli, deny.cli);  // true/false

// Check filesystem access
checkReadPermission("/tmp/data.csv", allow.read, deny.read);  // true/false
checkWritePermission("/tmp/out.txt", allow.write, deny.write); // true/false

// Check network access
checkNetPermission("api.github.com", allow.net, deny.net);    // true/false
```

## Parsing and Exporting

```typescript
import { parseBandMd, exportBandMd } from "@bands/format";

// Parse a band file
const source = await Bun.file("./BAND.md").text();
const { document, errors } = parseBandMd(source);

// Export back to BAND.md format
const output = exportBandMd(document);
```

## Validation

The parser validates:
- Required fields (`band`, `icon`, `description`)
- Valid emoji for `icon`
- Valid glob patterns
- Numeric limits (or parseable duration/size strings)
- No unknown top-level keys

Validation errors are returned but don't prevent parsing - the document is still usable with warnings.
