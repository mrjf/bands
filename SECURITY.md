# Security Model

Bands executes untrusted scripts in isolated Linux VMs. This document
describes what is enforced, what is not, and the threat model.

## Execution Targets

| Target | Isolation | Status |
|--------|-----------|--------|
| `local-dangerously` | None. Reports permissions but does not enforce. | Development only. |
| `local-lima` | Lima VM with iptables + bubblewrap + user separation. | Implemented and tested. |
| `cloudflare` | V8 isolates. | Placeholder — not implemented. |

## Lima VM Enforcement

### Enforced at kernel level

| Layer | Mechanism | Bypass resistance |
|-------|-----------|-------------------|
| **Network egress** | Per-execution iptables chain with UID-owner matching. Default REJECT, explicit ACCEPT for `allow.net` hosts. deny.net adds REJECT before ACCEPT. | Kernel-level. No subprocess can bypass. Tested with curl, wget, python, /dev/tcp. |
| **Filesystem** | Bubblewrap mount namespace. `/etc` (ro), `/run` (rw), workdir (rw). | Kernel-level. `/home`, host `/tmp`, and unlisted paths are invisible. |
| **User separation** | Scripts run as `band-runner` (unprivileged) via sudo inside bwrap. UID preserved for iptables matching. | OS-level. Cannot read other users' files or escalate. |
| **Process isolation** | Full VM boundary (KVM / Virtualization.framework). | Hypervisor-level. |

### Enforced at application level

| Layer | Mechanism | How it works |
|-------|-----------|--------------|
| **CLI allow** | PATH set to wrapper-only directory. Only declared commands exist. | Commands not in `allow.cli` return "command not found". |
| **CLI deny** | Proxy shell wrappers check full command line against deny glob patterns. | `deny.cli: ["rm -rf *"]` blocks `rm -rf /` but allows `rm file`. |
| **File copy-in** | `allow.read` files copied into VM workdir. `deny.read` files excluded. | Enforcement at host copy boundary. Script only sees what's staged. |
| **File copy-out** | Output files written back only if matching `allow.write` and not `deny.write`. | Enforcement at host copy boundary. |
| **Insist** | CLI wrappers log invocations. Server checks ops against `insist` patterns after execution. | Script succeeds only if all insist patterns are satisfied. |
| **Size limits** | `maxInputBytes` checked before execution. `maxOutputBytes` checked after. | Band server rejects oversized input/output. |

### Not enforced

| Feature | Status |
|---------|--------|
| `maxCostDollars` | Parsed but not checked. Blocked on skills that call Claude API internally. |
| seccomp profiles | Not implemented. Mitigated by bwrap namespace + VM boundary. |
| Cloudflare executor | Placeholder. |

## Secrets

- Secrets passed as environment variables via `env.sh` in the workdir.
- Workdir only visible inside the bwrap mount namespace.
- Other processes in the VM cannot see the workdir.
- Workdir cleaned up (`sudo rm -rf`) after every execution.
- Base64 encoding used to avoid shell quoting issues, not for security.

## Threat Model

**Designed for:** Trusted skill authors whose scripts may have bugs or
unintended behavior. The isolation prevents accidental data exfiltration,
network abuse, and cross-skill interference.

**Not designed for:** Determined adversaries with arbitrary code execution
inside the VM. The VM boundary is the hard security line. Everything
inside the VM is defense-in-depth.

**Known limitations:**
- CLI enforcement is PATH-based. Full-path binary execution (`/usr/bin/curl`)
  bypasses PATH wrappers, but network firewall still blocks undeclared hosts.
- File deny enforcement is at the copy boundary, not OS-level. Inside the
  sandbox, the script has full access to everything in the workdir.
- `deny.read`/`deny.write` patterns are checked during copy-in/copy-out,
  not enforced inside the VM filesystem.
