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
- **Status: TODO**
- `insist` (required operations) is not checked in the server-based path.
- The old embedded server had insist tracking but it was removed with packages/server.
- **Implementation:** Band server tracks operations performed during execution and checks against insist requirements before returning success.

### 10. deny.net
- **Status: TODO**
- `deny.net` is parsed but the iptables firewall only uses `allow.net`.
- Deny is implicit (REJECT default), so anything not in allow.net is blocked.
- Explicit deny.net would be needed if allow.net contains wildcards and you want to exclude specific hosts within that wildcard (e.g., allow `*.github.com` but deny `evil.github.com`).
- **Implementation:** Add REJECT rules for deny.net hosts before ACCEPT rules in the per-execution iptables chain.

### 11. limit.maxInputBytes / limit.maxOutputBytes
- **Status: TODO**
- Parsed but not checked in the band server path.
- **Implementation:** Band server checks input size before execution, output size after. Reject if exceeded.

### 12. Cost limit enforcement (maxCostDollars)
- **Status: TODO**
- Parsed but never checked.
- Cost tracking is for skills that make Claude API calls from inside the VM. No current skills do this.
- **Blocked on:** Having a skill that calls Claude from inside the VM.

## Not implemented

### 13. Cloudflare executor
- **Status: PLACEHOLDER**
- Echoes input back. No real execution.
- `packages/runtime/src/worker.ts`
- Separate track from Lima hardening.
