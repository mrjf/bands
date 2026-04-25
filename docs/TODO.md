# TODO — Hardening & Stubs

Tracked issues with enforcement, isolation, and unimplemented features.
See also: `SECURITY.md` for the current threat model.

## Done

### 1. Network egress enforcement
- Per-execution iptables chains in Lima VM. Kernel-level REJECT.
- UID-based matching (only band-runner traffic restricted).
- Tested: curl, wget, python, /dev/tcp all blocked.

### 2. Filesystem restrictions (OS-level)
- Bubblewrap mount namespace. /etc (ro), /run (rw), workdir (rw).
- /home, host /tmp isolated. /etc/shadow not readable.

### 3. User privilege separation
- Scripts run as band-runner via sudo inside bwrap.
- Real UID preserved for iptables matching.

### 4. Contract string ref resolution (file paths)
- File path refs resolved against workdir. URL refs skipped.

### 5. Secrets handling
- Workdir owned by band-runner, cleaned up after execution.
- /proc environ isolated per-user.

### 6. Band server (v3.0)
- HTTP server in Lima VM. Single-use mutex. POST /exec.
- Handles iptables + bwrap setup/teardown per execution.

### 7. packages/server removal
- Dead code removed. Superseded by band-server.ts.

## Parsed but not enforced

### 8. CLI command deny enforcement
- **Status: DONE** (deny.cli via proxy shell wrappers)
- For each command in `deny.cli`, the band server creates a wrapper script that shadows the real binary via PATH prepend. The wrapper checks the full command line against deny glob patterns. If matched, exits 126. Otherwise exec's the real binary.
- Example: `deny.cli: ["rm -rf *"]` blocks `rm -rf /` but allows `rm file`.
- Note: `allow.cli` selective binary mounting was attempted but reverted due to setuid/nosuid complications. Full `/usr` is mounted read-only; deny wrappers provide argument-level enforcement.
- Tested: deny blocks matching, allows non-matching, rm -rf denied, no-deny works.

### 9. Insist enforcement
- **Status: DONE**
- CLI wrappers log invocations to ops tracker file (`BAND_OPS_FILE`).
- After execution, server checks ops against `insist.cli` patterns.
- `insist.write`: checks if files exist. `insist.read`: checks ops log. `insist.net`: checks iptables counters.
- Tested: cli passes/fails, specific pattern match, write fails, no-insist succeeds.

### 10. deny.net
- **Status: DONE**
- deny.net hosts are resolved to IPs and added as REJECT rules BEFORE ACCEPT rules in iptables.
- Supports: allow wildcard + deny specific (e.g., allow `*.github.com` deny `api.github.com`).
- Supports: allow `*` + deny specific (allow everything except denied hosts).
- deny.cli: DONE (via wrapper pattern matching).
- deny.read/deny.write: TODO (needs file-command wrappers to check paths against deny patterns).

### 11. limit.maxInputBytes / limit.maxOutputBytes
- **Status: TODO**
- Parsed but not checked in the band server path.
- **Implementation:** Band server checks input size before execution, output size after. Reject if exceeded.

### 12. Cost limit enforcement (maxCostDollars)
- **Status: TODO**
- Parsed but never checked.
- Cost tracking is for skills that make Claude API calls from inside the VM. No current skills do this.
- **Blocked on:** Having a skill that calls Claude from inside the VM.

## Not production-tested

### 13. Cloudflare executor
- **Status: IMPLEMENTED, NOT PRODUCTION-TESTED**
- `CloudflareExecutor` class exists and is registered. Requires wrangler + API token.
- Needs real-world testing before production use.
