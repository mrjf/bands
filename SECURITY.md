# Security

Bands executes untrusted scripts in isolated Linux VMs. This document describes what is enforced, what is not, and the threat model.

## Enforcement layers

### Kernel-level

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| Network egress | Per-execution iptables chain, UID-owner matched | Default REJECT. Explicit ACCEPT for `allow.net` hosts. `deny.net` adds REJECT before ACCEPT. No subprocess can bypass. |
| Filesystem | Bubblewrap mount namespace | `allow.read` mounted read-only. `allow.write` mounted read-write. `deny.read`/`deny.write` excluded from mounts. All other paths invisible. |
| User separation | Scripts run as `band-runner` via sudo inside bwrap | Cannot read other users' files or escalate. UID preserved for iptables matching. |
| Process isolation | Full VM boundary (KVM / Virtualization.framework) | Hypervisor-level. |

### Application-level

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| CLI allow | PATH set to wrapper-only directory | Commands not in `allow.cli` do not exist. |
| CLI deny | Proxy wrappers check full command line against deny globs | `deny.cli: ["rm -rf *"]` blocks `rm -rf /` but allows `rm file`. |
| Insist | CLI wrappers log invocations, server checks ops after execution | Run fails if insist patterns are not satisfied. |

### Not yet enforced

| Feature | Status |
|---------|--------|
| `maxInputBytes` / `maxOutputBytes` | Parsed, not checked |
| `maxCostDollars` | Parsed, not checked |
| seccomp profiles | Not implemented. Mitigated by bwrap namespace + VM boundary. |

## File I/O

1. Band server writes `input.json` to a fresh workdir
2. Script runs inside bubblewrap — only declared paths visible
3. Script writes to `$OUTPUT_PATH`
4. Band server reads output, returns JSON
5. Workdir deleted after every execution

## Secrets

Secrets passed as env vars via `env.sh` in the workdir. Only visible inside the bwrap mount namespace. Cleaned up after every execution.

## Threat model

**Designed for** trusted skill authors whose scripts may have bugs or unintended behavior. Isolation prevents accidental data exfiltration, network abuse, and cross-skill interference.

**Not designed for** determined adversaries with arbitrary code execution inside the VM. The VM boundary is the hard security line. Everything inside is defense-in-depth.

## Known limitations

- Bash builtins (`echo`, `test`, `[`) bypass PATH wrappers. Insist patterns for builtins won't be tracked via the ops log.
- DNS-based iptables rules resolve hostnames at execution time. CDN IP rotation mid-request may cause connection failure.
