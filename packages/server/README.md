# @bands/server

HTTP server that enforces band permissions. Deploys to Lima VM (as Bun server) or Cloudflare Workers.

## Usage

```typescript
import { createBandApp, createSandbox } from "@bands/server";

// Create Hono app with band enforcement
const app = createBandApp();

// Create execution sandbox
const sandbox = createSandbox(bandConfig);
```

## API

| Function | Description |
|----------|-------------|
| `createBandApp()` | Create a Hono HTTP app with band enforcement routes |
| `createSandbox(band)` | Create an execution sandbox constrained by band permissions |

## Endpoints

### `POST /init`

Initialize the server with a band configuration. Creates an execution sandbox.

```json
// Request: BandDocument body
{
  "band": "my-band",
  "icon": "🔒",
  "version": 1,
  "description": "My band",
  "allow": { "cli": ["echo *"] },
  "deny": { "cli": ["rm *"] }
}
```

Response:
```json
{ "ok": true, "band": "my-band", "version": 1 }
```

### `POST /`

Execute a payload against the initialized band. Requires prior `/init`.

```json
// Request: payload sent directly (no wrapper)
{ "runCli": ["echo hello"] }
```

Response:
```json
{
  "success": true,
  "data": { ... },
  "permissions": { ... },
  "enforced": true
}
```

Error (not initialized):
```json
{ "error": { "code": "NOT_INITIALIZED", "message": "Call /init first" } }
```

### `GET /health`

```json
{ "ready": true, "band": "my-band", "version": 1 }
```

### `GET /band`

Debug endpoint. Returns the currently loaded band configuration, or a `NOT_INITIALIZED` error.

## Permission Enforcement

1. **Deny check** — If the operation matches a deny pattern, return `PERMISSION_DENIED`
2. **Allow check** — If the operation matches an allow pattern, proceed
3. **Default deny** — If no pattern matches, return `PERMISSION_DENIED`
4. **Insist tracking** — All operations are recorded; at the end, verify all insist requirements are satisfied

## Deployment

The same code runs on both targets:

- **Lima VM**: Deployed as a Bun HTTP server on port 9000
- **Cloudflare Workers**: Deployed as a Worker via Wrangler

See [Executors](../../docs/executors.md) for deployment details.
