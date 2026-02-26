# Future Work

## Typed Input/Output Schemas

Bands can define JSON Schema references for input and output validation:

```yaml
schemas:
  input:
    ref: github:org/repo/schemas/input.json
  output:
    ref: github:org/repo/schemas/output.json
```

### Implementation notes

- Fetch schemas from GitHub URLs (with caching)
- Validate input payload against `schemas.input` before execution
- Validate output against `schemas.output` before returning
- Return 400 for invalid input, 500 for invalid output
- Support JSON Schema draft-07 or later
- Consider AJV for validation

## Returns Configuration

Bands can declare which return modes they support:

```yaml
returns:
  supports: [sync, stream, async]
  default: sync
```

### Implementation notes

- `sync`: Default mode, returns JSON when complete
- `stream`: SSE streaming of chunks
- `async`: Returns job ID immediately, poll for results
- Validation ensures default is in supports list
- Effective policy computation intersects parent/child supports

## Streaming Support

The band server currently only supports sync execution. Streaming would allow:

- Real-time output as bands process data
- SSE (Server-Sent Events) responses
- Chunk-by-chunk results for long-running operations

### Implementation notes

- Add `?mode=stream` query parameter
- Return `Content-Type: text/event-stream`
- Yield `data: {...}\n\n` for each chunk
- End with `event: done\ndata: {metrics}\n\n`
- Sandbox would need to support async generators

## Async Execution

For long-running bands that exceed HTTP timeout limits:

- Return job ID immediately: `{ jobId: "abc123" }`
- Poll `GET /jobs/:id` for status
- Respect `maxAsyncDurationMs` limit from band config
- Store results temporarily for retrieval
- Webhook callback option for completion notification

### Implementation notes

- Need job queue (in-memory for Lima, Durable Objects for Cloudflare)
- Job states: `pending`, `running`, `completed`, `failed`
- Cleanup old jobs after TTL
- Consider Redis/KV for distributed state

## Other Future Work

### Fly.io Executor

Similar to Lima/Cloudflare - deploy `@bands/server` to Fly.io Machines:

- Persistent VMs with HTTP endpoint
- Geographic distribution
- Auto-scaling based on demand

### Firecracker Support (Linux only)

For Linux hosts, Firecracker microVMs provide:

- Sub-second boot times
- Minimal overhead (~5MB memory)
- Strong isolation (separate kernel)
- Used by AWS Lambda and Fly.io

### Warm Pool

Pre-warm execution environments for faster cold starts:

- Keep N instances ready
- Recycle after use
- Different pools per band or shared
