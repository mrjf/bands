# Execution Targets

Bands can run on different execution targets, each providing different levels of isolation and enforcement.

## Overview

| Target | Isolation | Enforcement | Use Case |
|--------|-----------|-------------|----------|
| `local-dangerously` | None | Reports only | Development, testing |
| `local-lima` | Full (VM) | Enforces | Production on macOS |
| `cloudflare` | Full (V8) | Enforces | Production at edge |

## local-dangerously

Runs the band in the current process with **no isolation**.

```typescript
const result = await executeBand(band, payload, {
  target: "local-dangerously"
});
```

**Behavior:**
- Always available
- Does NOT enforce permissions - only reports what would be allowed
- Returns `enforced: false` in responses
- Useful for development and testing permission configurations

**Response example:**
```json
{
  "success": true,
  "data": {
    "permissions": {
      "cli": { "command": "rm -rf /", "allowed": false }
    },
    "enforced": false
  }
}
```

Even though `allowed: false`, the operation would succeed because `enforced: false`.

## local-lima

Runs the band in a **Lima VM** on macOS using Virtualization.framework.

```typescript
const result = await executeBand(band, payload, {
  target: "local-lima"
});
```

**Requirements:**
- macOS with Apple Silicon or Intel
- Lima installed (`brew install lima`)
- `bands-executor` VM running (`limactl start bands-executor`)

**Behavior:**
- Full Linux VM isolation
- Permissions are **enforced** - denied operations fail
- Insist requirements are **enforced** - missing operations fail
- Server runs on port 9000 inside VM, forwarded to host

**Setup:**
```bash
# Install Lima
brew install lima

# Create the VM (first time only)
limactl create --name=bands-executor template://ubuntu

# Start the VM
limactl start bands-executor

# Verify it's running
limactl list
```

**Configuration:**
```yaml
execution:
  target: local-lima
  lima:
    vmName: bands-executor  # Default
    port: 9000              # Default
```

**How it works:**
1. Executor checks if VM is running via `limactl list`
2. Sends HTTP request to `http://localhost:9000/execute`
3. Server inside VM enforces permissions and returns result

## cloudflare

Runs the band on **Cloudflare Workers** using V8 isolates.

```typescript
const result = await executeBand(band, payload, {
  target: "cloudflare"
});
```

**Requirements:**
- Wrangler CLI installed (`bun add -g wrangler`)
- Cloudflare account with API token
- Environment variables set:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

**Behavior:**
- V8 isolate isolation (same as web browsers)
- Permissions are **enforced**
- Insist requirements are **enforced**
- Worker deployed on-demand, reused for subsequent requests

**Setup:**
```bash
# Install wrangler
bun add -g wrangler

# Login to Cloudflare
wrangler login

# Set environment variables
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

**Configuration:**
```yaml
execution:
  target: cloudflare
  cloudflare:
    workerName: my-band     # Worker name (default: band-{name})
    accountId: abc123       # Can also use env var
```

**How it works:**
1. Executor checks if worker exists via health endpoint
2. If not, deploys worker via `wrangler deploy`
3. Sends HTTP request to `https://band-{name}.{account}.workers.dev/execute`
4. Worker enforces permissions and returns result

**Worker URL pattern:**
```
https://band-{band-name}.cf-{account-prefix}.workers.dev
```

## Executor Interface

All executors implement the same interface:

```typescript
interface Executor {
  name: string;
  target: ExecutionTarget;

  isAvailable(): Promise<boolean>;
  execute(input: ExecutorInput): Promise<ExecutorResult>;
  cleanup?(): Promise<void>;
}

interface ExecutorInput {
  band: BandDocument;
  payload: unknown;
  workdir?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

interface ExecutorResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  metrics: {
    startupMs: number;
    durationMs: number;
    inputBytes: number;
    outputBytes: number;
  };
  target: ExecutionTarget;
}
```

## Checking Availability

```typescript
import { isTargetAvailable, listAvailableTargets } from "@bands/runtime";

// Check specific target
const limaAvailable = await isTargetAvailable("local-lima");

// List all available targets
const targets = await listAvailableTargets();
// ["local-dangerously", "local-lima"]  // if Lima VM is running
```

## Using the CLI

```bash
# Check available targets
bun run packages/runtime/src/cli.ts targets

# Output:
# ✓ local-dangerously
#     Run in current process (no isolation)
#     Isolation: None - full system access
#
# ✓ local-lima
#     Run in Lima VM (macOS)
#     Isolation: Full - Linux VM via Virtualization.framework
#
# ✗ cloudflare
#     Run on Cloudflare Workers
#     Isolation: Full - V8 isolates, edge deployment
#     Requires: wrangler + CLOUDFLARE_API_TOKEN

# Run with specific target
bun run packages/runtime/src/cli.ts run ./my-band.md \
  --target local-lima \
  --input '{"task": "process data"}'
```

## Enforcement Differences

| Behavior | local-dangerously | local-lima | cloudflare |
|----------|-------------------|------|------------|
| Permission denied | Returns `allowed: false`, continues | Returns error, fails | Returns error, fails |
| Insist not met | Reports missing, succeeds | Returns error, fails | Returns error, fails |
| Network blocked | Reports, allows anyway | Actually blocks | Actually blocks |
| File access denied | Reports, allows anyway | Actually blocks | N/A (no filesystem) |

## Metrics

All executors return execution metrics:

```typescript
const result = await executeBand(band, payload, { target: "local-lima" });

console.log(result.metrics);
// {
//   startupMs: 5,      // Time to initialize executor
//   durationMs: 142,   // Total execution time
//   inputBytes: 256,   // Request payload size
//   outputBytes: 1024  // Response size
// }
```

## Error Codes

| Code | Meaning |
|------|---------|
| `PERMISSION_DENIED` | Operation blocked by allow/deny rules |
| `INSIST_NOT_SATISFIED` | Required operations not performed |
| `INPUT_TOO_LARGE` | Payload exceeds `maxInputBytes` |
| `OUTPUT_TOO_LARGE` | Response exceeds `maxOutputBytes` |
| `TIMEOUT` | Execution exceeded `maxRuntimeMs` |
| `NOT_INITIALIZED` | Server not ready (internal) |
| `LIMA_ERROR` | Lima VM error |
| `CLOUDFLARE_ERROR` | Cloudflare Worker error |
