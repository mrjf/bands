# TODO — Hardening & Stubs

Tracked issues with enforcement, isolation, and unimplemented features. Each item has a status and location in the codebase.

## Isolation & Enforcement

### 1. Network egress enforcement
- **Status: DONE** (iptables in Lima VM)
- `lima-exec.ts` injects per-execution iptables chains based on `allow.net`
- Kernel-level REJECT — no subprocess can bypass
- Tested: curl, wget, python, /dev/tcp all blocked

### 2. Filesystem restrictions (OS-level)
- **Status: NOT ENFORCED**
- Currently application-level glob matching only
- Symlinks could bypass path restrictions
- No chroot, mount namespaces, or AppArmor
- **Location:** `packages/runtime/src/setup.ts` (band server), `lima-exec.ts`
- **Fix:** Use `chroot` or bind-mount a restricted directory tree before execution. Or use AppArmor profiles to restrict file access by path.

### 3. Permission enforcement tests
- **Status: DISABLED**
- Commented out with `// TODO: Enable when permission enforcement is implemented`
- **Location:** `packages/runtime/test/integration/executor-suite.ts` lines 455-473
- **Blocked on:** Items 2 (filesystem) — network is now done

### 4. User privilege separation in VM
- **Status: NOT IMPLEMENTED**
- Scripts run as the default Lima user (broad permissions)
- No seccomp, no capability dropping, no dedicated unprivileged user
- **Fix:** Create a `band-runner` user with minimal permissions. Run scripts as that user via `sudo -u band-runner`. Drop capabilities with `capsh`.

## Stubs (parsed but not enforced)

### 5. Env/secrets management
- **Status: STUB**
- `getAllowedEnv()` returns `{}` always
- **Location:** `packages/server/src/sandbox.ts`
- **Test:** `packages/server/test/env.test.ts`

### 6. Contract string ref resolution
- **Status: STUB**
- Inline JSON Schema objects validate. String refs (paths/URLs) silently skipped.
- **Location:** `packages/server/src/app.ts`, `packages/runtime/src/executors/index.ts` — `typeof schema === "object"` guard
- **Tests:** `packages/server/test/app.test.ts`, `packages/runtime/test/executors/index.test.ts`

### 7. Cost limit enforcement
- **Status: STUB**
- `limit.maxCostDollars` parsed but never checked during execution
- **Location:** `packages/server/src/app.ts`
- **Test:** `packages/server/test/app.test.ts`

### 8. Cloudflare worker handler
- **Status: PLACEHOLDER**
- Echoes input back. No real execution.
- **Location:** `packages/runtime/src/worker.ts`

### 9. Server sandbox executeCode()
- **Status: PLACEHOLDER**
- Returns `{ executed: true }` without doing anything
- **Location:** `packages/server/src/sandbox.ts`

## Secrets Handling

### 10. Secrets exposure in Lima VM
- **Status: KNOWN RISK**
- Secrets passed as base64-encoded env vars in temp files
- Visible in `/proc/<pid>/environ` to any process in the VM
- Temp files cleaned up best-effort only
- **Fix:** Use kernel keyring (`keyctl`), or write secrets to a tmpfs that is unmounted after execution. At minimum, run scripts as a different user so `/proc` access is restricted.

## Docs

### 11. User-facing docs don't mention stubs
- **Status: NOT DONE**
- `docs/TODO.md` (this file) tracks stubs but nothing in user-facing docs calls out what's enforced vs. not
- **Fix:** Add a SECURITY.md that honestly describes the current threat model and enforcement status
