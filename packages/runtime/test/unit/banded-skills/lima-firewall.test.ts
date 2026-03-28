import { describe, expect, test } from "bun:test";
import { buildFirewallScript, buildBwrapCommand } from "../../../src/banded-skills/lima-exec";

describe("buildFirewallScript", () => {
  test("returns null when no rules provided", () => {
    expect(buildFirewallScript("BAND-test", undefined)).toBeNull();
  });

  test("returns null when allowNet is empty", () => {
    expect(
      buildFirewallScript("BAND-test", { allowNet: [], denyNet: [] })
    ).toBeNull();
  });

  test("returns null when allowNet contains wildcard *", () => {
    expect(
      buildFirewallScript("BAND-test", { allowNet: ["*"], denyNet: [] })
    ).toBeNull();
  });

  test("creates chain with correct name", () => {
    const script = buildFirewallScript("BAND-abc123", {
      allowNet: ["example.com"],
      denyNet: [],
    });
    expect(script).toContain("iptables -N BAND-abc123");
  });

  test("allows loopback", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("-o lo -j ACCEPT");
  });

  test("allows established/related connections", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("ESTABLISHED,RELATED");
  });

  test("allows DNS on port 53", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("--dport 53 -j ACCEPT");
  });

  test("resolves and allows specific hosts", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["api.github.com"],
      denyNet: [],
    })!;
    expect(script).toContain('getent ahosts "api.github.com"');
    expect(script).toContain("-j ACCEPT");
  });

  test("handles wildcard subdomains", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["*.github.com"],
      denyNet: [],
    })!;
    expect(script).toContain('getent ahosts "github.com"');
    expect(script).toContain('getent ahosts "api.github.com"');
    expect(script).toContain('getent ahosts "www.github.com"');
  });

  test("ends with REJECT default", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    const lines = script.split("\n");
    const rejectLine = lines.findIndex((l) => l.includes("-j REJECT"));
    const insertLine = lines.findIndex((l) => l.includes("-I OUTPUT"));
    expect(rejectLine).toBeGreaterThan(0);
    expect(insertLine).toBeGreaterThan(rejectLine);
  });

  test("inserts chain into OUTPUT for new connections", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("-I OUTPUT 1 -m state --state NEW -j BAND-test");
  });

  test("handles multiple allowed hosts", () => {
    const script = buildFirewallScript("BAND-test", {
      allowNet: ["api.github.com", "slack.com", "pypi.org"],
      denyNet: [],
    })!;
    expect(script).toContain('getent ahosts "api.github.com"');
    expect(script).toContain('getent ahosts "slack.com"');
    expect(script).toContain('getent ahosts "pypi.org"');
  });
});

describe("buildBwrapCommand", () => {
  test("includes bwrap with unshare-user", () => {
    const cmd = buildBwrapCommand("/tmp/workdir", { uid: 999, gid: 988 });
    expect(cmd).toContain("bwrap");
    expect(cmd).toContain("--unshare-user");
  });

  test("drops to specified uid/gid", () => {
    const cmd = buildBwrapCommand("/tmp/workdir", { uid: 999, gid: 988 });
    expect(cmd).toContain("--uid 999");
    expect(cmd).toContain("--gid 988");
  });

  test("mounts system binaries read-only", () => {
    const cmd = buildBwrapCommand("/tmp/workdir");
    expect(cmd).toContain("--ro-bind /usr /usr");
    expect(cmd).toContain("--ro-bind /bin /bin");
    expect(cmd).toContain("--ro-bind /lib /lib");
  });

  test("mounts workdir read-write", () => {
    const cmd = buildBwrapCommand("/tmp/band-exec-abc123");
    expect(cmd).toContain("--bind /tmp/band-exec-abc123 /tmp/band-exec-abc123");
  });

  test("isolates /tmp and /home with tmpfs", () => {
    const cmd = buildBwrapCommand("/tmp/workdir");
    expect(cmd).toContain("--tmpfs /tmp");
    expect(cmd).toContain("--tmpfs /home");
  });

  test("includes DNS and TLS mounts", () => {
    const cmd = buildBwrapCommand("/tmp/workdir");
    expect(cmd).toContain("--ro-bind /etc/resolv.conf /etc/resolv.conf");
    expect(cmd).toContain("--ro-bind-try /etc/ssl /etc/ssl");
  });

  test("sources env.sh and runs run.sh", () => {
    const cmd = buildBwrapCommand("/tmp/workdir");
    expect(cmd).toContain("source /tmp/workdir/env.sh");
    expect(cmd).toContain("bash /tmp/workdir/run.sh");
  });
});
