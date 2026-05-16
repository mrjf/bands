# Execution Targets

Bands run on execution targets that provide isolation and enforcement.


## Overview

| Target | Isolation | Enforcement | Status |
|--------|-----------|-------------|--------|
| `lima` | Full (Linux VM) | Enforces permissions | Available |
| `cloudflare` | Full (V8 isolate) | — | Placeholder |


## lima

Runs the band in a Lima VM on macOS using Virtualization.framework.

```typescript
const result = await executeBand(band, payload, {
  target: "local-lima"
});
```

Requirements: macOS, Lima installed (`brew install lima`), `bands-executor` VM running.

Behavior:

- Full Linux VM isolation
- Permissions enforced — denied operations fail
- Insist requirements enforced — missing operations fail
- Server on port 9000 inside VM, forwarded to host

Setup:

```bash
brew install lima
limactl create --name=bands-executor template://ubuntu
limactl start bands-executor
limactl list   # verify
```

Configuration:

```yaml
execution:
  target: lima
  lima:
    vmName: bands-executor  # default
    port: 9000              # default
```

How it works:

1. Checks VM status via `limactl list`
2. Sends HTTP request to `http://localhost:9000/exec`
3. Band server sets up iptables firewall, creates bwrap sandbox
4. Script runs as `band-runner` inside sandbox
5. Server checks insist requirements, returns result, tears down firewall


## cloudflare

Placeholder. Not yet available.


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

const limaAvailable = await isTargetAvailable("local-lima");
const targets = await listAvailableTargets();
```


## Metrics

All executors return execution metrics:

```typescript
const result = await executeBand(band, payload, { target: "local-lima" });
console.log(result.metrics);
// { startupMs: 5, durationMs: 142, inputBytes: 256, outputBytes: 1024 }
```


## Error Codes

| Code | Meaning |
|------|---------|
| `PERMISSION_DENIED` | Blocked by allow/deny rules |
| `INSIST_NOT_SATISFIED` | Required operations not performed |
| `INPUT_TOO_LARGE` | Exceeds `maxInputBytes` |
| `OUTPUT_TOO_LARGE` | Exceeds `maxOutputBytes` |
| `TIMEOUT` | Exceeds `maxRuntimeMs` |
| `NOT_INITIALIZED` | Server not ready |
| `LIMA_ERROR` | Lima VM error |
