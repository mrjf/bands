# Server Protocol

The `@bands/server` package provides an HTTP server that enforces band permissions. This document describes the HTTP API that executors use to communicate with the server.

## Overview

The server is stateless - each request includes both the band configuration and the payload. This allows the same server deployment to handle multiple bands.

```
┌──────────────┐         POST /execute          ┌──────────────┐
│   Executor   │ ─────────────────────────────▶ │    Server    │
│              │   { band, payload }            │              │
│              │ ◀───────────────────────────── │  Enforces    │
└──────────────┘   { success, data, metrics }   │  Permissions │
                                                └──────────────┘
```

## Endpoints

### GET /health

Health check endpoint.

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:9000
```

**Response:**
```json
{
  "ready": true
}
```

### POST /execute

Execute a band with the given payload.

**Request:**
```http
POST /execute HTTP/1.1
Host: localhost:9000
Content-Type: application/json

{
  "band": {
    "band": "my-band",
    "icon": "🔒",
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
  },
  "payload": {
    "testCli": "echo hello"
  }
}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Band-Input-Bytes: 128
X-Band-Output-Bytes: 256
X-Band-Duration-Ms: 15

{
  "success": true,
  "band": "my-band",
  "permissions": {
    "cli": {
      "command": "echo hello",
      "allowed": true
    }
  },
  "enforced": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
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

## Payload Types

The server recognizes three types of payloads:

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
  "executedOn": "lima"
}
```

## Response Headers

The server includes metrics in response headers:

| Header | Description |
|--------|-------------|
| `X-Band-Input-Bytes` | Size of the request payload |
| `X-Band-Output-Bytes` | Size of the response body |
| `X-Band-Duration-Ms` | Server-side execution time |

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PERMISSION_DENIED` | 403 | Operation blocked by allow/deny rules |
| `INSIST_NOT_SATISFIED` | 400 | Required operations not performed |
| `INVALID_REQUEST` | 400 | Malformed request (missing band or payload) |
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
# 1. Health check
curl http://localhost:9000/health
# {"ready":true}

# 2. Test a permission
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "band": {
      "band": "test",
      "icon": "🧪",
      "allow": { "cli": ["echo *"] },
      "deny": { "cli": ["rm *"] }
    },
    "payload": { "testCli": "echo hello" }
  }'
# {"success":true,"permissions":{"cli":{"command":"echo hello","allowed":true}},"enforced":true}

# 3. Test a denied operation
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "band": {
      "band": "test",
      "icon": "🧪",
      "allow": { "cli": ["echo *"] },
      "deny": { "cli": ["rm *"] }
    },
    "payload": { "testCli": "rm -rf /" }
  }'
# {"success":false,"error":{"code":"PERMISSION_DENIED","message":"CLI command denied: rm -rf /"},"enforced":true}
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
