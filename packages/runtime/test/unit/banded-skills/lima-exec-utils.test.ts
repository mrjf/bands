import { describe, expect, test } from "bun:test";
import {
  buildBwrapCommand,
  extractMountPath,
  buildFirewallScript,
} from "../../../src/banded-skills/lima-exec-utils";

describe("buildBwrapCommand", () => {
  test("includes system bind mounts", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain("--ro-bind /usr /usr");
    expect(cmd).toContain("--ro-bind /lib /lib");
    expect(cmd).toContain("--ro-bind /bin /bin");
    expect(cmd).toContain("--ro-bind /sbin /sbin");
    expect(cmd).toContain("--symlink usr/lib64 /lib64");
  });

  test("includes network and TLS mounts", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain("--ro-bind /etc/resolv.conf /etc/resolv.conf");
    expect(cmd).toContain("--ro-bind-try /etc/ssl /etc/ssl");
    expect(cmd).toContain("--ro-bind-try /etc/ca-certificates /etc/ca-certificates");
  });

  test("includes proc, dev, tmpfs mounts", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain("--proc /proc");
    expect(cmd).toContain("--dev /dev");
    expect(cmd).toContain("--tmpfs /tmp");
    expect(cmd).toContain("--tmpfs /home");
  });

  test("bind-mounts the workdir read-write", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain("--bind /work/abc /work/abc");
  });

  test("sources env.sh and run.sh from workdir via sudo", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain(
      "-- /usr/bin/sudo -u band-runner /bin/bash -c 'source /work/abc/env.sh && source /work/abc/run.sh'"
    );
  });

  test("includes sudo/PAM/DNS system files", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain("--ro-bind /etc/passwd /etc/passwd");
    expect(cmd).toContain("--ro-bind /etc/group /etc/group");
    expect(cmd).toContain("--ro-bind-try /etc/sudoers /etc/sudoers");
    expect(cmd).toContain("--ro-bind-try /etc/sudoers.d /etc/sudoers.d");
    expect(cmd).toContain("--ro-bind-try /etc/pam.d /etc/pam.d");
    expect(cmd).toContain("--ro-bind-try /etc/security /etc/security");
    expect(cmd).toContain("--ro-bind-try /etc/login.defs /etc/login.defs");
    expect(cmd).toContain("--ro-bind-try /etc/nsswitch.conf /etc/nsswitch.conf");
    expect(cmd).toContain("--ro-bind-try /run/systemd/resolve /run/systemd/resolve");
  });

  test("includes --die-with-parent", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd).toContain("--die-with-parent");
  });

  test("works with a deeply nested workdir path", () => {
    const cmd = buildBwrapCommand("/data/users/runner/workspace/project-123");
    expect(cmd).toContain(
      "--bind /data/users/runner/workspace/project-123 /data/users/runner/workspace/project-123"
    );
    expect(cmd).toContain(
      "source /data/users/runner/workspace/project-123/env.sh && source /data/users/runner/workspace/project-123/run.sh"
    );
  });

  test("starts with bwrap command", () => {
    const cmd = buildBwrapCommand("/work/abc");
    expect(cmd.startsWith("bwrap ")).toBe(true);
  });

  describe("with fileRules", () => {
    test("adds read-only mounts for allowRead patterns", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/etc/myapp/config.json"],
        allowWrite: [],
      });
      expect(cmd).toContain("--ro-bind-try /etc/myapp /etc/myapp");
    });

    test("adds read-write mounts for allowWrite patterns", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: [],
        allowWrite: ["/var/data/output.txt"],
      });
      expect(cmd).toContain("--bind-try /var/data /var/data");
    });

    test("deduplicates mount paths across allowRead and allowWrite", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/opt/data/file1.txt"],
        allowWrite: ["/opt/data/file2.txt"],
      });
      // First mount wins (read-only from allowRead)
      const matches = cmd.match(/\/opt\/data/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(2); // once in the flag, once in the target
      expect(cmd).toContain("--ro-bind-try /opt/data /opt/data");
      expect(cmd).not.toContain("--bind-try /opt/data /opt/data");
    });

    test("handles glob patterns in allowRead", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/opt/configs/**/*.yaml"],
        allowWrite: [],
      });
      expect(cmd).toContain("--ro-bind-try /opt/configs /opt/configs");
    });

    test("handles glob patterns in allowWrite", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: [],
        allowWrite: ["/var/logs/*.log"],
      });
      expect(cmd).toContain("--bind-try /var/logs /var/logs");
    });

    test("skips system prefix paths from fileRules", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/usr/local/bin/mytool", "/bin/something"],
        allowWrite: ["/lib/custom/thing"],
      });
      // These should NOT produce additional mount entries since they are system prefixes
      // already mounted as ro-bind at the top
      // The system mounts should still be there, but no --ro-bind-try or --bind-try for them
      expect(cmd).not.toContain("--ro-bind-try /usr/local");
      expect(cmd).not.toContain("--bind-try /lib/custom");
    });

    test("handles multiple allowRead entries with different directories", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/opt/a/file.txt", "/opt/b/file.txt"],
        allowWrite: [],
      });
      expect(cmd).toContain("--ro-bind-try /opt/a /opt/a");
      expect(cmd).toContain("--ro-bind-try /opt/b /opt/b");
    });

    test("deduplicates within allowRead itself", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/opt/data/a.txt", "/opt/data/b.txt"],
        allowWrite: [],
      });
      const roBindMatches = cmd.match(/--ro-bind-try \/opt\/data \/opt\/data/g);
      expect(roBindMatches).not.toBeNull();
      expect(roBindMatches!.length).toBe(1);
    });

    test("fileRules mounts appear before system file mounts", () => {
      const cmd = buildBwrapCommand("/work/abc", undefined, {
        allowRead: ["/opt/data/config.json"],
        allowWrite: [],
      });
      const fileRuleIdx = cmd.indexOf("--ro-bind-try /opt/data /opt/data");
      const passwdIdx = cmd.indexOf("--ro-bind /etc/passwd /etc/passwd");
      expect(fileRuleIdx).toBeGreaterThan(-1);
      expect(passwdIdx).toBeGreaterThan(-1);
      expect(fileRuleIdx).toBeLessThan(passwdIdx);
    });

    test("empty fileRules arrays produce no extra mounts", () => {
      const cmdWithRules = buildBwrapCommand("/work/abc", undefined, {
        allowRead: [],
        allowWrite: [],
      });
      const cmdWithout = buildBwrapCommand("/work/abc");
      expect(cmdWithRules).toBe(cmdWithout);
    });
  });

  describe("userIds parameter", () => {
    test("accepts userIds without error", () => {
      // userIds is accepted but not currently used in the command construction
      const cmd = buildBwrapCommand("/work/abc", { uid: 1000, gid: 1000 });
      expect(cmd).toContain("bwrap");
      expect(cmd).toContain("--bind /work/abc /work/abc");
    });

    test("produces same output with and without userIds", () => {
      // Currently userIds is unused in the implementation
      const cmdWith = buildBwrapCommand("/work/abc", { uid: 1000, gid: 1000 });
      const cmdWithout = buildBwrapCommand("/work/abc");
      expect(cmdWith).toBe(cmdWithout);
    });
  });
});

describe("extractMountPath", () => {
  test("returns parent directory for a literal file path", () => {
    expect(extractMountPath("/opt/data/config.json")).toBe("/opt/data");
  });

  test("returns parent directory for a directory path with trailing slash", () => {
    expect(extractMountPath("/opt/data/subdir/")).toBe("/opt/data/subdir");
  });

  test("returns directory up to glob ** pattern", () => {
    expect(extractMountPath("/opt/configs/**/*.yaml")).toBe("/opt/configs");
  });

  test("returns directory up to glob * pattern", () => {
    expect(extractMountPath("/var/logs/*.log")).toBe("/var/logs");
  });

  test("returns directory up to glob ? pattern", () => {
    expect(extractMountPath("/var/logs/file?.log")).toBe("/var/logs");
  });

  test("returns directory up to glob [ pattern", () => {
    expect(extractMountPath("/var/logs/file[0-9].log")).toBe("/var/logs");
  });

  test("returns directory up to glob { pattern", () => {
    expect(extractMountPath("/opt/{a,b}/config")).toBe("/opt");
  });

  test("returns null for /usr prefix", () => {
    expect(extractMountPath("/usr/local/bin/tool")).toBeNull();
  });

  test("returns null for /lib prefix", () => {
    expect(extractMountPath("/lib/x86_64/libfoo.so")).toBeNull();
  });

  test("returns null for /lib64 prefix", () => {
    expect(extractMountPath("/lib64/something")).toBeNull();
  });

  test("returns null for /bin prefix", () => {
    expect(extractMountPath("/bin/bash")).toBeNull();
  });

  test("returns null for /sbin prefix", () => {
    expect(extractMountPath("/sbin/iptables")).toBeNull();
  });

  test("returns null for /dev prefix", () => {
    expect(extractMountPath("/dev/null")).toBeNull();
  });

  test("returns null for /proc prefix", () => {
    expect(extractMountPath("/proc/self/status")).toBeNull();
  });

  test("returns null for exact system prefix path", () => {
    expect(extractMountPath("/usr")).toBeNull();
    expect(extractMountPath("/bin")).toBeNull();
    expect(extractMountPath("/lib")).toBeNull();
  });

  test("returns null for root-only path", () => {
    // A file directly under / yields dir = "/"
    expect(extractMountPath("/file.txt")).toBeNull();
  });

  test("returns parent for relative paths with multiple segments", () => {
    // extractMountPath does not reject relative paths with slashes — it extracts
    // the parent directory. Only single-segment relative paths return null.
    expect(extractMountPath("relative/path/file.txt")).toBe("relative/path");
  });

  test("returns null for bare filename", () => {
    expect(extractMountPath("file.txt")).toBeNull();
  });

  test("handles glob at the top-level directory", () => {
    // /*/something -> concrete is "/" before the glob, lastSlash = 0, dir = "/"
    expect(extractMountPath("/*")).toBeNull();
  });

  test("returns valid path for /etc subpath (non-system prefix)", () => {
    expect(extractMountPath("/etc/myapp/config.yaml")).toBe("/etc/myapp");
  });

  test("returns valid path for /opt subpath", () => {
    expect(extractMountPath("/opt/tools/bin/mytool")).toBe("/opt/tools/bin");
  });

  test("returns valid path for /home subpath", () => {
    expect(extractMountPath("/home/user/.config/app.conf")).toBe(
      "/home/user/.config"
    );
  });

  test("returns valid path for /var subpath", () => {
    expect(extractMountPath("/var/data/output/result.json")).toBe(
      "/var/data/output"
    );
  });

  test("handles path with only two levels", () => {
    expect(extractMountPath("/opt/file.txt")).toBe("/opt");
  });

  test("returns null for empty string", () => {
    expect(extractMountPath("")).toBeNull();
  });

  test("handles glob immediately after first directory", () => {
    expect(extractMountPath("/opt/*/config")).toBe("/opt");
  });

  test("handles path with spaces", () => {
    expect(extractMountPath("/opt/my data/file.txt")).toBe("/opt/my data");
  });
});

describe("buildFirewallScript", () => {
  test("returns null when rules are undefined", () => {
    expect(buildFirewallScript("BAND_123")).toBeNull();
  });

  test("returns null when allowNet is empty", () => {
    expect(
      buildFirewallScript("BAND_123", { allowNet: [], denyNet: [] })
    ).toBeNull();
  });

  test("returns null when allowNet contains wildcard *", () => {
    expect(
      buildFirewallScript("BAND_123", { allowNet: ["*"], denyNet: [] })
    ).toBeNull();
  });

  test("returns null when wildcard is among other entries", () => {
    expect(
      buildFirewallScript("BAND_123", {
        allowNet: ["example.com", "*"],
        denyNet: [],
      })
    ).toBeNull();
  });

  test("creates chain and flushes on rebuild", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    });
    expect(script).not.toBeNull();
    expect(script).toContain(
      "iptables -N BAND_X 2>/dev/null || iptables -F BAND_X"
    );
  });

  test("allows loopback traffic", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("iptables -A BAND_X -o lo -j ACCEPT");
  });

  test("allows established and related connections", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain(
      "iptables -A BAND_X -m state --state ESTABLISHED,RELATED -j ACCEPT"
    );
  });

  test("allows DNS traffic (udp and tcp port 53)", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("iptables -A BAND_X -p udp --dport 53 -j ACCEPT");
    expect(script).toContain("iptables -A BAND_X -p tcp --dport 53 -j ACCEPT");
  });

  test("adds getent lookup for a simple hostname", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["api.example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("# Allow api.example.com");
    expect(script).toContain('getent ahosts "api.example.com"');
    expect(script).toContain("iptables -A BAND_X -d \"$ip\" -j ACCEPT");
  });

  test("handles wildcard domain (*.example.com)", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["*.example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("# Allow *.example.com");
    // Should resolve the base domain
    expect(script).toContain('getent ahosts "example.com"');
    // Should also resolve common subdomains
    expect(script).toContain('getent ahosts "api.example.com"');
    expect(script).toContain('getent ahosts "www.example.com"');
  });

  test("wildcard domain resolves base and api/www prefixes", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["*.myservice.io"],
      denyNet: [],
    })!;
    expect(script).toContain('getent ahosts "myservice.io"');
    expect(script).toContain('getent ahosts "api.myservice.io"');
    expect(script).toContain('getent ahosts "www.myservice.io"');
  });

  test("ends with REJECT rule", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    const lines = script.split("\n");
    const rejectLine = lines.find((l) => l.includes("-j REJECT"));
    expect(rejectLine).toBeDefined();
    expect(rejectLine).toContain("iptables -A BAND_X -j REJECT");
  });

  test("inserts OUTPUT chain rule for new connections", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    expect(script).toContain(
      "iptables -I OUTPUT 1 -m state --state NEW -j BAND_X"
    );
  });

  test("OUTPUT rule is the last line", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    const lines = script.split("\n");
    expect(lines[lines.length - 1]).toBe(
      "iptables -I OUTPUT 1 -m state --state NEW -j BAND_X"
    );
  });

  test("handles multiple allowed hosts", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["api.example.com", "cdn.example.com", "auth.example.com"],
      denyNet: [],
    })!;
    expect(script).toContain("# Allow api.example.com");
    expect(script).toContain("# Allow cdn.example.com");
    expect(script).toContain("# Allow auth.example.com");
    expect(script).toContain('getent ahosts "api.example.com"');
    expect(script).toContain('getent ahosts "cdn.example.com"');
    expect(script).toContain('getent ahosts "auth.example.com"');
  });

  test("handles mix of wildcard and simple domains", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["*.github.com", "registry.npmjs.org"],
      denyNet: [],
    })!;
    // Wildcard domain
    expect(script).toContain('getent ahosts "github.com"');
    expect(script).toContain('getent ahosts "api.github.com"');
    expect(script).toContain('getent ahosts "www.github.com"');
    // Simple domain
    expect(script).toContain('getent ahosts "registry.npmjs.org"');
  });

  test("uses the provided chainName throughout", () => {
    const script = buildFirewallScript("MY_CUSTOM_CHAIN", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    // Every iptables line should reference the chain name
    const lines = script.split("\n").filter((l) => l.startsWith("iptables"));
    for (const line of lines) {
      expect(line).toContain("MY_CUSTOM_CHAIN");
    }
  });

  test("denyNet entries do not appear in the script (deny is implicit via final REJECT)", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: ["evil.com"],
    })!;
    // denyNet is not explicitly handled — the final REJECT covers everything not allowed
    expect(script).not.toContain("evil.com");
  });

  test("ordering: loopback before established before DNS before hosts before REJECT", () => {
    const script = buildFirewallScript("BAND_X", {
      allowNet: ["example.com"],
      denyNet: [],
    })!;
    const loIdx = script.indexOf("-o lo -j ACCEPT");
    const estIdx = script.indexOf("--state ESTABLISHED,RELATED");
    const dnsIdx = script.indexOf("--dport 53");
    const hostIdx = script.indexOf("# Allow example.com");
    const rejectIdx = script.indexOf("-j REJECT");
    const outputIdx = script.indexOf("-I OUTPUT 1");

    expect(loIdx).toBeLessThan(estIdx);
    expect(estIdx).toBeLessThan(dnsIdx);
    expect(dnsIdx).toBeLessThan(hostIdx);
    expect(hostIdx).toBeLessThan(rejectIdx);
    expect(rejectIdx).toBeLessThan(outputIdx);
  });

  test("returns null with wildcard even if other rules or denyNet exist", () => {
    expect(
      buildFirewallScript("BAND_X", {
        allowNet: ["example.com", "*", "other.com"],
        denyNet: ["evil.com"],
      })
    ).toBeNull();
  });

  test("wildcard * as first entry returns null", () => {
    expect(
      buildFirewallScript("BAND_X", {
        allowNet: ["*", "example.com"],
        denyNet: [],
      })
    ).toBeNull();
  });
});
