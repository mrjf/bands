# Security Model

Bands executes untrusted scripts in isolation. This document describes
what is enforced, what is not, and the current threat model.

## Execution Targets

| Target | Isolation | Use Case |
|--------|-----------|----------|
| `local-dangerously` | None. Reports permissions but does not enforce them. | Development only. |
| `local-lima` | Lima VM (full Linux kernel). Network, user, and process isolation enforced. | Default for `band` CLI. |
| `cloudflare` | V8 isolate. Not yet implemented beyond placeholder. | Future. |

## Lima VM Enforcement (local-lima)

### Enforced at kernel level

| Layer | Mechanism | Bypass resistance |
|-------|-----------|-------------------|
| **Network egress** | Per-execution iptables chain. Default REJECT, explicit ACCEPT for `allow.net` hosts. | Kernel-level. No subprocess (curl, wget, python, raw sockets) can bypass. |
| **User separation** | Scripts run as `band-runner` (unprivileged system user, no home dir, no login shell). | OS-level. Cannot read other users' files or `/proc/*/environ`. |
| **Process isolation** | Full VM boundary (KVM / Virtualization.framework). | Hypervisor-level. |

### Enforced at application level

| Layer | Mechanism | Limitations |
|-------|-----------|-------------|
| **CLI command allow/deny** | Pattern matching in band server, returns 403. | Only checked when using the HTTP executor path. Script-based path (`lima-exec.ts`) does not enforce CLI restrictions — the script runs `bash` directly. |
| **File read/write allow/deny** | Pattern matching in band server. | Application-level only. No OS-level filesystem restrictions (no chroot, AppArmor, or mount namespaces). Symlink traversal is not prevented. |

### Not enforced

| Feature | Status |
|---------|--------|
| Filesystem OS-level restrictions | Not implemented. Scripts can read/write anything `band-runner` has access to. |
| seccomp / capability dropping | Not implemented. `band-runner` has default Linux capabilities. |
| AppArmor / SELinux profiles | Not implemented. |
| Cost limits (`maxCostDollars`) | Parsed but never checked. |

## Secrets

- Secrets are passed as environment variables via a file (`env.sh`) in the
  execution workdir.
- The workdir is `chmod 700` owned by `band-runner`.
- `env.sh` is `chmod 600` — only `band-runner` can read it.
- `/proc/<pid>/environ` is only readable by the process owner (`band-runner`),
  not by other users in the VM.
- Workdir is cleaned up (`sudo rm -rf`) after every execution.
- Base64 encoding is used to avoid shell quoting issues, not for security.

## Threat Model

**Designed for:** Trusted skill authors whose scripts may have bugs or
unintended behavior. The isolation prevents accidental data exfiltration,
network abuse, and cross-skill interference.

**Not designed for:** Determined adversaries with arbitrary code execution
inside the VM. A malicious script running as `band-runner` could:

- Read/write any file accessible to `band-runner` (most of `/tmp`, shared dirs)
- Inspect the local filesystem structure
- Attempt privilege escalation via kernel exploits (mitigated by VM boundary)

The VM boundary itself is the hard security line. Everything inside the VM
is defense-in-depth.

## Questions for Future Work

- Should we add AppArmor profiles to restrict `band-runner` filesystem access?
- Should we use `unshare --mount` to create per-execution mount namespaces?
- Should CLI command allow/deny be enforced in the script-based path (`lima-exec.ts`)?
- Should we support cost tracking and enforcement for API-calling skills?
