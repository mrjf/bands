# TODO — Hardening & Stubs

Tracked issues with enforcement, isolation, and unimplemented features.
See also: `SECURITY.md` for the current threat model.

## Isolation & Enforcement

### 1. Network egress enforcement
- **Status: DONE**
- Per-execution iptables chains in Lima VM. Kernel-level REJECT.
- Tested: curl, wget, python, /dev/tcp all blocked.
- `packages/runtime/src/banded-skills/lima-exec.ts`

### 2. Filesystem restrictions (OS-level)
- **Status: DONE** (bubblewrap mount namespace)
- Scripts run inside `bwrap --unshare-user` with explicit bind mounts.
- Only system binaries (ro) and workdir (rw) are visible.
- /home, /etc/passwd, host /tmp, and all other paths are invisible.
- Tested: /etc/passwd blocked, /home empty, /tmp writes don't escape.
- **TODO:** File copy-in/copy-out for skills that need to modify local files.

### 3. Permission enforcement tests
- **Status: PARTIALLY DONE**
- Network enforcement tested in `lima-firewall.test.ts`
- Filesystem enforcement tested in `lima-firewall.test.ts` (bwrap isolation)
- HTTP executor path tests still disabled: `executor-suite.ts:455-473`

### 4. User privilege separation
- **Status: DONE**
- bwrap `--unshare-user --uid/--gid` drops to band-runner inside sandbox.
- Tested: uid is not root, /home empty, /etc/passwd blocked, workdir cleanup.

### 5. Contract string ref resolution
- **Status: DONE** (file paths)
- File path refs (e.g., `./schemas/input.json`) resolved against workdir.
- URL refs still skipped (would need fetch + caching).
- **Question:** Should URL refs be supported? Adds network dependency to validation.
- `packages/runtime/src/executors/index.ts`

## Stubs (parsed but not enforced)

### 6. Server path stubs
- **Status: REMOVED**
- `packages/server/` was dead code superseded by `band-server.ts` (runs in VM).
- Removed entirely.

### 7. Cost limit enforcement
- **Status: TODO**
- `limit.maxCostDollars` parsed but never checked.
- **Approach:** Track via Claude Code's cost return values at the agent harness layer (`scripts/agent-test-helpers.ts`), not at the VM/band-server level. The VM runs bash scripts — it has no concept of API cost. The caller (Claude Code) knows the cost.
- **Implementation:** After each `agentCall()`, read cost from Claude's response headers/metadata, accumulate, and refuse further calls when budget is exceeded.
- **Blocked on:** Claude Code exposing cost per invocation in a machine-readable way.

### 8. Cloudflare executor implementation
- **Status: PLACEHOLDER**
- Echoes input back. No real execution.
- `packages/runtime/src/worker.ts`
- Separate track from Lima hardening.

## Secrets Handling

### 10. Secrets exposure in Lima VM
- **Status: DONE** (mitigated)
- Secrets in `chmod 600` file in `chmod 700` dir owned by `band-runner`.
- `/proc` environ isolated per-user.
- Workdir cleaned up after execution.
- **Remaining risk:** Secrets still in process env vars during execution. Kernel keyring (`keyctl`) would be more secure but adds complexity.
