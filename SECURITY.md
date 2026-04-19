# Security Model

Bands executes untrusted scripts in isolated Linux VMs. This document
describes what is enforced, what is not, and the threat model.

## Execution Targets

| Target | Isolation | Status |
|--------|-----------|--------|
| `local-dangerously` | None. Reports permissions but does not enforce. | Development only. |
| `local-lima` | Lima VM with iptables + bubblewrap + user separation. | Implemented and tested. |
| `cloudflare` | Coming soon. | Not yet available. |

## Lima VM Enforcement

### Enforced at kernel level

| Layer | Mechanism | Bypass resistance |
|-------|-----------|-------------------|
| **Network egress** | Per-execution iptables chain with UID-owner matching. Default REJECT, explicit ACCEPT for `allow.net` hosts. deny.net adds REJECT before ACCEPT. | Kernel-level. No subprocess can bypass. Tested with curl, wget, python, /dev/tcp. |
| **Filesystem** | Bubblewrap mount namespace. `/etc` (ro), `/run` (rw), workdir (rw). `allow.read` paths mounted read-only, `allow.write` paths mounted read-write. `deny.read`/`deny.write` patterns excluded from mounts. All other paths invisible. | Kernel-level. `/home`, host `/tmp`, and unlisted paths are invisible. |
| **User separation** | Scripts run as `band-runner` (unprivileged) via sudo inside bwrap. UID preserved for iptables matching. | OS-level. Cannot read other users' files or escalate. |
| **Process isolation** | Full VM boundary (KVM / Virtualization.framework). | Hypervisor-level. |

### Enforced at application level

| Layer | Mechanism | How it works |
|-------|-----------|--------------|
| **CLI allow** | PATH set to wrapper-only directory. Only declared commands exist. | Commands not in `allow.cli` return "command not found". |
| **CLI deny** | Proxy shell wrappers check full command line against deny glob patterns. | `deny.cli: ["rm -rf *"]` blocks `rm -rf /` but allows `rm file`. |
| **File read/write** | `allow.read` directories bind-mounted read-only into bwrap sandbox. `allow.write` directories bind-mounted read-write. `deny.read`/`deny.write` patterns excluded from mounts. Paths not in allow lists are not mounted and do not exist inside the sandbox. | Kernel-level via mount namespace. Scripts cannot access paths outside declared permissions. |
| **Insist** | CLI wrappers log invocations. Server checks ops against `insist` patterns after execution. | Script succeeds only if all insist patterns are satisfied. |

### Not yet enforced

| Feature | Status |
|---------|--------|
| `maxInputBytes` / `maxOutputBytes` | Parsed but not checked. Coming soon. |
| `maxCostDollars` | Parsed but not checked. Blocked on skills that call Claude API internally. |
| seccomp profiles | Not implemented. Mitigated by bwrap namespace + VM boundary. |

## File I/O Model

Scripts receive input and produce output via JSON files in an isolated workdir:

1. **Input**: Band server writes `input.json` to a fresh workdir. Script reads from `$INPUT_PATH`.
2. **Execution**: Script runs inside a bubblewrap mount namespace. Only explicitly allowed paths are visible.
3. **Output**: Script writes to `$OUTPUT_PATH`. Band server reads and returns it as JSON.
4. **Cleanup**: Workdir is deleted (`rm -rf`) after every execution.

File access permissions are enforced by bubblewrap mount namespace:
- `allow.read` patterns → directories bind-mounted read-only
- `allow.write` patterns → directories bind-mounted read-write
- `deny.read` patterns → excluded from read-only mounts
- `deny.write` patterns → excluded from read-write mounts
- Everything else → not mounted, invisible to the script

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

**Defense in depth:**
- CLI enforcement uses PATH wrappers + bash `extdebug` trap. The trap blocks
  absolute path execution (`/usr/bin/curl`), forcing everything through PATH.
  Scripts are sourced (not subprocess'd) so the trap applies to all commands.
- File access enforcement is via bwrap mount namespace. Paths not in
  `allow.read`/`allow.write` (minus `deny.read`/`deny.write` exclusions)
  simply do not exist inside the sandbox.
- Network firewall is the backstop: even if a command somehow executes,
  it can't reach undeclared hosts.

## Known Limitations

- **Bash builtins bypass CLI wrappers**: Commands like `echo`, `test`, `[`
  are bash builtins and don't go through the PATH wrapper scripts. This
  means insist patterns for builtins won't be tracked via the ops log.
  The host-side executor checks insist separately.
- **DNS-based iptables**: Network rules resolve hostnames to IPs at
  execution time. If a CDN rotates IPs mid-request, the connection may
  fail. Rules are set up fresh per-request to minimize staleness.
