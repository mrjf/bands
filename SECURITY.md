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
| **Filesystem** | Bubblewrap mount namespace (`bwrap --unshare-user`). Only system binaries (ro) and workdir (rw) are visible. | Kernel-level. `/home`, `/etc/passwd`, host `/tmp`, and all other paths are invisible. |
| **User separation** | `bwrap --uid/--gid` drops to `band-runner` inside the sandbox. | Namespace-level. Runs as unprivileged user, cannot escalate. |
| **Process isolation** | Full VM boundary (KVM / Virtualization.framework). | Hypervisor-level. |

### Enforced at application level

| Layer | Mechanism | Limitations |
|-------|-----------|-------------|
| **CLI command allow/deny** | Pattern matching in band server, returns 403. | Only checked when using the HTTP executor path. Script-based path (`lima-exec.ts`) does not enforce CLI restrictions — the script runs `bash` directly. |

### Not enforced

| Feature | Status |
|---------|--------|
| File copy-in/out | Scripts that need to modify local files must have files copied into the workdir. Not yet implemented. |
| seccomp / capability dropping | Not implemented. Mitigated by bwrap user namespace. |
| Cost limits (`maxCostDollars`) | Parsed but never checked. |

## Secrets

- Secrets are passed as environment variables via a file (`env.sh`) in the
  execution workdir.
- The workdir is only visible inside the bwrap mount namespace.
- Other processes in the VM cannot see the workdir or its contents.
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

- Should CLI command allow/deny be enforced in the script-based path (`lima-exec.ts`)?
- Should we support cost tracking and enforcement for API-calling skills?
- Should we add file copy-in/out for skills that need to read/write local files?
- Should we add seccomp profiles on top of bwrap namespace isolation?
