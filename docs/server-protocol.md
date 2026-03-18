# Server Protocol

The `@bands/server` package provides an HTTP server that enforces band permissions. This document describes the HTTP API that executors use to communicate with the server.

## Overview

The server is stateful — a band is loaded once via `POST /init`, then payloads are executed against it via `POST /`. This keeps execution requests lightweight since the band configuration is already in memory.

```
┌──────────────┐       1. POST /init              ┌──────────────┐
│   Executor   │ ─────────────────────────────▶   │    Server    │
│              │   BandDocument body              │              │
│              │ ◀─────────────────────────────   │  Loads band, │
│              │   { ok, band, version }          │  creates     │
│              │                                  │  sandbox     │
│              │       2. POST /                  │              │
│              │ ─────────────────────────────▶   │  Enforces    │
│              │   payload (any)                  │  Permissions │
│              │ ◀─────────────────────────────   │              │
└──────────────┘   result | { error }             └──────────────┘
```

## Endpoints

### GET /health

Health check endpoint. Returns the server's readiness state along with the currently loaded band name and version.

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:9000
```

**Response (band loaded):**
```json
{
  "ready": true,
  "band": "my-band",
  "version": 1
}
```

**Response (no band loaded):**
```json
{
  "ready": false,
  "band": null,
  "version": null
}
```

### POST /init

Initialize the server with a band configuration. Creates an execution sandbox constrained by the band's permissions.

**Request:**
```http
POST /init HTTP/1.1
Host: localhost:9000
Content-Type: application/json

{
  "band": "my-band",
  "icon": "🔒",
  "version": 1,
  "description": "My band",
  "allow": {
    "cli": ["echo *"],
    "read": ["/tmp/**"]
  },
  "deny": {
    "cli": ["rm *"]
  },
  "insist": {
    "cli": ["echo *"]
  }
}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true,
  "band": "my-band",
  "version": 1
}
```

**Error Response (Invalid Band):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "INVALID_BAND",
    "message": "Missing required fields"
  }
}
```

**Error Response (Init Failed):**
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": {
    "code": "INIT_ERROR",
    "message": "Init failed"
  }
}
```

### POST /

Execute a payload against the initialized band. Requires a prior successful `POST /init` call.

**Request:**
```http
POST / HTTP/1.1
Host: localhost:9000
Content-Type: application/json

{
  "testCli": "echo hello"
}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Band-Input-Bytes: 24
X-Band-Output-Bytes: 128
X-Band-Duration-Ms: 15

{
  "success": true,
  "permissions": {
    "cli": {
      "command": "echo hello",
      "allowed": true
    }
  },
  "enforced": true
}
```

**Error Response (Not Initialized):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "NOT_INITIALIZED",
    "message": "Call /init first"
  }
}
```

**Error Response (Permission Denied):**
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
X-Band-Duration-Ms: 2

{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "CLI command denied: rm -rf /"
  },
  "permissions": {
    "cli": {
      "command": "rm -rf /",
      "allowed": false
    }
  },
  "enforced": true
}
```

**Error Response (Insist Not Satisfied):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "INSIST_NOT_SATISFIED",
    "message": "Required operations not performed: cli:echo *"
  },
  "insist": {
    "satisfied": false,
    "missing": [
      { "category": "cli", "pattern": "echo *" }
    ]
  },
  "enforced": true
}
```

### GET /band

Debug endpoint. Returns the currently loaded band configuration.

**Request:**
```http
GET /band HTTP/1.1
Host: localhost:9000
```

**Response (band loaded):**
```json
{
  "band": "my-band",
  "icon": "🔒",
  "version": 1,
  "description": "My band",
  "allow": { "cli": ["echo *"] },
  "deny": { "cli": ["rm *"] }
}
```

**Error Response (no band loaded):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "NOT_INITIALIZED",
    "message": "No band loaded"
  }
}
```

## Payload Types

The server recognizes three types of payloads. Since the band is already loaded via `/init`, payloads are sent directly without a wrapper.

### 1. Firewall Test Payloads

Check if operations would be allowed without actually executing them.

```json
{
  "testCli": "rm -rf /",
  "testRead": "/etc/passwd",
  "testWrite": "/usr/bin/malware",
  "testNet": "evil.com"
}
```

**Response:**
```json
{
  "success": true,
  "permissions": {
    "cli": { "command": "rm -rf /", "allowed": false },
    "read": { "path": "/etc/passwd", "allowed": false },
    "write": { "path": "/usr/bin/malware", "allowed": false },
    "net": { "host": "evil.com", "allowed": false }
  },
  "enforced": true
}
```

If any permission is denied and `enforced: true`, the response will be a 403 error.

### 2. Operation Payloads

Actually execute operations and track them for insist verification.

```json
{
  "runCli": ["echo hello", "ls -la /tmp"],
  "readFiles": ["/tmp/config.json"],
  "writeFiles": [
    { "path": "/tmp/output.txt", "content": "result data" }
  ],
  "fetchUrls": ["https://api.example.com/data"]
}
```

**Response:**
```json
{
  "success": true,
  "band": "my-band",
  "operations": {
    "cli": [
      { "command": "echo hello", "allowed": true, "output": "hello\n" },
      { "command": "ls -la /tmp", "allowed": true, "output": "..." }
    ],
    "read": [
      { "path": "/tmp/config.json", "allowed": true, "content": "{...}" }
    ],
    "write": [
      { "path": "/tmp/output.txt", "allowed": true, "bytesWritten": 11 }
    ],
    "fetch": [
      { "url": "https://api.example.com/data", "allowed": true, "status": 200 }
    ]
  },
  "tracker": {
    "cli": ["echo hello", "ls -la /tmp"],
    "read": ["/tmp/config.json"],
    "write": ["/tmp/output.txt"],
    "net": ["api.example.com"]
  },
  "insist": {
    "satisfied": true,
    "missing": []
  },
  "enforced": true
}
```

### 3. Regular Payloads

Any other payload is passed through with band info added.

```json
{
  "message": "hello",
  "data": { "key": "value" }
}
```

**Response:**
```json
{
  "success": true,
  "band": "my-band",
  "input": {
    "message": "hello",
    "data": { "key": "value" }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "executedOn": "local-lima"
}
```

## Response Headers

The server includes metrics in response headers on `POST /` responses:

| Header | Description |
|--------|-------------|
| `X-Band-Input-Bytes` | Size of the request payload |
| `X-Band-Output-Bytes` | Size of the response body |
| `X-Band-Duration-Ms` | Server-side execution time |

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_INITIALIZED` | 400 | `POST /` called before `POST /init` |
| `INVALID_BAND` | 400 | Band document missing required fields (`band`, `version`, `icon`) |
| `CONTRACT_INPUT_INVALID` | 400 | Request payload fails `contract.input` JSON Schema validation |
| `CONTRACT_OUTPUT_INVALID` | 400 | Response fails `contract.output` JSON Schema validation |
| `INPUT_TOO_LARGE` | 400 | Request payload exceeds `limit.maxInputBytes` |
| `OUTPUT_TOO_LARGE` | 400 | Response exceeds `limit.maxOutputBytes` |
| `PERMISSION_DENIED` | 403 | Operation blocked by allow/deny rules |
| `INSIST_NOT_SATISFIED` | 400 | Required operations not performed |
| `INIT_ERROR` | 500 | Failed to create sandbox from band config |
| `EXECUTION_ERROR` | 500 | Internal execution error |

## CORS

The server includes CORS headers for cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Deployment

### Lima VM

The server runs as a Bun process inside the VM:

```bash
# Inside VM
bun run server.ts
# Listening on http://0.0.0.0:9000
```

Port 9000 is forwarded to the host, so executors connect to `http://localhost:9000`.

### Cloudflare Workers

The server is deployed as a Worker:

```bash
wrangler deploy
# Deployed to https://band-name.account.workers.dev
```

The same code runs in both environments - only the deployment method differs.

## Example: Full Request Flow

```bash
# 1. Health check (no band loaded yet)
curl http://localhost:9000/health
# {"ready":false,"band":null,"version":null}

# 2. Initialize with a band
curl -X POST http://localhost:9000/init \
  -H "Content-Type: application/json" \
  -d '{
    "band": "test",
    "icon": "🧪",
    "version": 1,
    "description": "Test band",
    "allow": { "cli": ["echo *"] },
    "deny": { "cli": ["rm *"] }
  }'
# {"ok":true,"band":"test","version":1}

# 3. Health check (band loaded)
curl http://localhost:9000/health
# {"ready":true,"band":"test","version":1}

# 4. Test an allowed operation
curl -X POST http://localhost:9000/ \
  -H "Content-Type: application/json" \
  -d '{ "testCli": "echo hello" }'
# {"success":true,"permissions":{"cli":{"command":"echo hello","allowed":true}},"enforced":true}

# 5. Test a denied operation
curl -X POST http://localhost:9000/ \
  -H "Content-Type: application/json" \
  -d '{ "testCli": "rm -rf /" }'
# {"success":false,"error":{"code":"PERMISSION_DENIED","message":"CLI command denied: rm -rf /"},"enforced":true}

# 6. Debug: view loaded band config
curl http://localhost:9000/band
# {"band":"test","icon":"🧪","version":1,"description":"Test band","allow":{"cli":["echo *"]},"deny":{"cli":["rm *"]}}
```

## Implementation Notes

### Permission Checking Order

1. Check `deny` patterns first (deny takes precedence)
2. Check `allow` patterns
3. If no match, deny by default

```typescript
function checkPermission(value: string, allow: string[], deny: string[]): boolean {
  // Deny takes precedence
  for (const pattern of deny) {
    if (matchGlob(value, pattern)) return false;
  }
  // Check allow list
  for (const pattern of allow) {
    if (matchGlob(value, pattern)) return true;
  }
  // Default deny
  return false;
}
```

### Insist Tracking

Operations are tracked as they're performed:

```typescript
const tracker = { cli: [], read: [], write: [], net: [] };

// When running a CLI command
tracker.cli.push(command);

// When reading a file
tracker.read.push(path);

// At the end, verify insist requirements
for (const pattern of band.insist?.cli || []) {
  const found = tracker.cli.some(cmd => matchGlob(cmd, pattern));
  if (!found) {
    return { satisfied: false, missing: [{ category: "cli", pattern }] };
  }
}
```
