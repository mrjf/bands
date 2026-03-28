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
- **Status: NOT ENFORCED**
- Application-level glob matching only. Symlinks could bypass.
- No chroot, mount namespaces, or AppArmor.
- **Question:** AppArmor profiles vs `unshare --mount` vs chroot? AppArmor is simplest but requires profile authoring. Mount namespaces are more portable.
- `packages/runtime/src/banded-skills/lima-exec.ts`

### 3. Permission enforcement tests
- **Status: DISABLED**
- Commented out: `packages/runtime/test/integration/executor-suite.ts:455-473`
- **Blocked on:** #2 (filesystem restrictions)
- Network enforcement has its own test suite (`lima-firewall.test.ts`).

### 4. User privilege separation
- **Status: DONE**
- Scripts run as `band-runner` (system user, no home, no login shell).
- Workdir is `chmod 700`, env.sh is `chmod 600`.
- `/proc/*/environ` isolated per-user.
- Tested: whoami, home dir access, /proc isolation, cleanup.

### 5. Contract string ref resolution
- **Status: DONE** (file paths)
- File path refs (e.g., `./schemas/input.json`) resolved against workdir.
- URL refs still skipped (would need fetch + caching).
- **Question:** Should URL refs be supported? Adds network dependency to validation.
- `packages/runtime/src/executors/index.ts`

## Stubs (parsed but not enforced)

### 6. Env/secrets management (server path)
- **Status: STUB**
- `getAllowedEnv()` returns `{}` in the HTTP server path.
- The script-based path (`lima-exec.ts`) handles secrets correctly.
- `packages/server/src/sandbox.ts`
- **Question:** Is the server path still needed? The script path is the primary execution mode for lima.

### 7. Cost limit enforcement
- **Status: STUB**
- `limit.maxCostDollars` parsed but never checked.
- `packages/server/src/app.ts`
- **Question:** How should cost be tracked? Per-execution metering? Aggregate budget? What counts as "cost"?

### 8. Cloudflare worker handler
- **Status: PLACEHOLDER**
- Echoes input back. No real execution.
- `packages/runtime/src/worker.ts`
- **Not blocking lima work.** Separate track.

### 9. Server sandbox executeCode()
- **Status: PLACEHOLDER**
- Returns `{ executed: true }`.
- `packages/server/src/sandbox.ts`
- **Question:** Same as #6 — is the server sandbox path still the right architecture?

## Secrets Handling

### 10. Secrets exposure in Lima VM
- **Status: DONE** (mitigated)
- Secrets in `chmod 600` file in `chmod 700` dir owned by `band-runner`.
- `/proc` environ isolated per-user.
- Workdir cleaned up after execution.
- **Remaining risk:** Secrets still in process env vars during execution. Kernel keyring (`keyctl`) would be more secure but adds complexity.
