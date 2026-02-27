# Architecture

This document describes the overall architecture of the Bands system.

## Overview

Bands is a permission and isolation system for AI agent execution. It consists of:

1. **Format** - A YAML-based configuration format for defining permissions
2. **Runtime** - Executors that run bands on different targets
3. **Server** - HTTP server that enforces permissions in sandboxed environments

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User / Agent                               │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ band.md + payload
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         @bands/runtime                               │
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│   │   local-    │  │    lima     │  │  cloudflare │                │
│   │ dangerously │  │  executor   │  │  executor   │                │
│   └─────────────┘  └──────┬──────┘  └──────┬──────┘                │
│          │                │                │                        │
└──────────┼────────────────┼────────────────┼────────────────────────┘
           │                │                │
           │ in-process     │ HTTP           │ HTTP
           ▼                ▼                ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │  No server │   │ Lima VM    │   │ Cloudflare │
    │  (direct)  │   │ :9000      │   │ Worker     │
    └────────────┘   │            │   │            │
                     │ @bands/    │   │ @bands/    │
                     │ server     │   │ server     │
                     └────────────┘   └────────────┘
```

## Components

### @bands/format

Pure library for parsing and manipulating band configurations.

```
packages/format/
├── src/
│   ├── parse.ts       # YAML parsing
│   ├── validate.ts    # Schema validation
│   ├── export.ts      # YAML serialization
│   ├── glob.ts        # Permission pattern matching
│   ├── effective.ts   # Compute effective policy (extends/includes)
│   ├── conflicts.ts   # Detect permission conflicts
│   └── types.ts       # TypeScript interfaces
└── test/
```

Key responsibilities:
- Parse BAND.md frontmatter
- Validate required fields and types
- Check permission patterns (glob matching)
- Compute effective policy from composition
- Export back to YAML

### @bands/runtime

Orchestrates band execution across different targets.

```
packages/runtime/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── executors/
│   │   ├── index.ts        # Registry and exports
│   │   ├── types.ts        # Executor interface
│   │   ├── local-dangerous.ts   # No isolation
│   │   ├── lima.ts         # Lima VM
│   │   └── cloudflare.ts   # Cloudflare Workers
│   └── skills/             # Skill execution
└── test/
    ├── executors/          # Unit tests
    └── integration/        # Cross-executor tests
```

Key responsibilities:
- Provide unified `executeBand()` API
- Manage executor lifecycle
- Deploy servers to targets (Lima, Cloudflare)
- Handle timeouts and metrics

### @bands/server

HTTP server that enforces band permissions. Same code deploys to:
- Lima VM (as Bun server)
- Cloudflare Workers (as Worker)

```
packages/server/
├── src/
│   ├── server.ts      # Hono HTTP app
│   ├── enforcement.ts # Permission checking
│   ├── insist.ts      # Insist tracking
│   └── types.ts       # Request/response types
└── test/
```

Key responsibilities:
- Receive band config + payload via HTTP
- Check firewall permissions (allow/deny)
- Track operations for insist verification
- Return structured results with metrics

## Execution Flow

### 1. Parse Band

```typescript
// User provides band.md content
const { document, errors } = parseBandMd(content);
```

### 2. Select Executor

```typescript
// Based on band config or override
const target = options.target || band.execution?.target || "local-dangerously";
const executor = await getExecutor(target);
```

### 3. Execute

For `local-dangerously`:
```typescript
// Run in-process, no HTTP call
const result = executor.execute({ band, payload });
// Reports what WOULD be allowed, but doesn't enforce
```

For `lima` or `cloudflare`:
```typescript
// 1. Ensure server is deployed
const serverUrl = await ensureServerDeployed(target);

// 2. Send HTTP request
const response = await fetch(`${serverUrl}/execute`, {
  method: "POST",
  body: JSON.stringify({ band, payload }),
});

// 3. Server enforces permissions and returns result
```

### 4. Server Enforcement

```typescript
// Inside @bands/server

// Check firewall permissions
if (isFirewallTest(payload)) {
  const allowed = checkPermission(payload.testCli, band.allow?.cli, band.deny?.cli);
  if (!allowed) {
    return { success: false, error: { code: "PERMISSION_DENIED" } };
  }
}

// Track operations for insist
if (isOperationPayload(payload)) {
  for (const cmd of payload.runCli) {
    tracker.cli.push(cmd);
    if (!checkPermission(cmd, band.allow?.cli, band.deny?.cli)) {
      return { success: false, error: { code: "PERMISSION_DENIED" } };
    }
  }

  // Verify insist requirements
  const insistCheck = checkInsistSatisfied(band, tracker);
  if (!insistCheck.satisfied) {
    return { success: false, error: { code: "INSIST_NOT_SATISFIED" } };
  }
}
```

## Test Payload Protocol

Tests use a special payload protocol to verify permissions:

### Firewall Tests (Permission Checks Only)

```typescript
// Ask "would this be allowed?"
{ testCli: "rm -rf /" }      // Check CLI permission
{ testRead: "/etc/passwd" }  // Check read permission
{ testWrite: "/usr/bin/x" }  // Check write permission
{ testNet: "evil.com" }      // Check network permission
```

Response:
```json
{
  "success": true,
  "permissions": {
    "cli": { "command": "rm -rf /", "allowed": false }
  },
  "enforced": true
}
```

### Operation Payloads (Actual Execution)

```typescript
// Actually perform operations (tracked for insist)
{ runCli: ["echo hello", "ls -la"] }
{ readFiles: ["/tmp/data.txt"] }
{ writeFiles: [{ path: "/tmp/out.txt", content: "data" }] }
{ fetchUrls: ["https://api.example.com"] }
```

## Permission Checking Algorithm

```typescript
function checkPermission(value: string, allow: string[], deny: string[]): boolean {
  // 1. Check deny list first (deny takes precedence)
  for (const pattern of deny) {
    if (matchGlob(value, pattern)) return false;
  }

  // 2. Check allow list
  for (const pattern of allow) {
    if (matchGlob(value, pattern)) return true;
  }

  // 3. Default deny
  return false;
}
```

## Insist Verification

```typescript
function checkInsistSatisfied(band: BandDocument, tracker: Tracker) {
  const missing = [];

  // Check each insist category
  for (const pattern of band.insist?.cli || []) {
    const found = tracker.cli.some(cmd => matchGlob(cmd, pattern));
    if (!found) missing.push({ category: "cli", pattern });
  }

  // ... same for read, write, net

  return { satisfied: missing.length === 0, missing };
}
```

## Deployment

### Lima VM

1. VM created with `limactl create`
2. Bun runtime installed via provisioning script
3. `@bands/server` built and copied to VM
4. Server started on port 9000
5. Port forwarded to host

### Cloudflare Workers

1. `@bands/server` bundled as Worker script
2. Deployed via `wrangler deploy`
3. Worker URL returned (e.g., `https://band-name.account.workers.dev`)

## Metrics

All executors return metrics:

```typescript
interface ExecutorMetrics {
  startupMs: number;    // Time to get executor ready
  durationMs: number;   // Total execution time
  inputBytes: number;   // Request payload size
  outputBytes: number;  // Response size
}
```

Servers also return metrics via headers:
- `X-Band-Input-Bytes`
- `X-Band-Output-Bytes`
- `X-Band-Duration-Ms`
