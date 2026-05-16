import { describe, expect, test } from "bun:test";
import { buildCliWrapperScript, buildDenyPatternsFile, SAFE_CMD_NAME } from "../../src/cli-wrapper";

describe("buildCliWrapperScript", () => {
  test("no-deny wrapper just logs and execs realPath", () => {
    const script = buildCliWrapperScript("ls", "/usr/bin/ls", false);
    expect(script).toContain("exec /usr/bin/ls");
    expect(script).not.toContain("DENY_PATTERNS");
    expect(script).not.toContain("eval");
    expect(script).not.toContain(".deny-");
  });

  test("deny wrapper reads patterns from side file, never embeds them", () => {
    const script = buildCliWrapperScript("rm", "/usr/bin/rm", true);
    expect(script).toContain("read -r P");
    expect(script).toContain('"$(dirname "$0")/.deny-rm"');
    expect(script).toContain("[[ \"$FULL_CMD\" == $P ]]");
    expect(script).not.toContain("eval");
    expect(script).not.toContain("DENY_PATTERNS=(");
  });

  test("rejects cmd names containing shell metacharacters", () => {
    expect(() => buildCliWrapperScript("rm$(id)", "/usr/bin/rm", false)).toThrow();
    expect(() => buildCliWrapperScript("rm;ls", "/usr/bin/rm", false)).toThrow();
    expect(() => buildCliWrapperScript("rm`id`", "/usr/bin/rm", false)).toThrow();
    expect(() => buildCliWrapperScript("rm ls", "/usr/bin/rm", false)).toThrow();
    expect(() => buildCliWrapperScript("../bin/rm", "/usr/bin/rm", false)).toThrow();
  });

  test("accepts conventional cmd names", () => {
    expect(() => buildCliWrapperScript("ls", "/usr/bin/ls", false)).not.toThrow();
    expect(() => buildCliWrapperScript("aws-cli", "/usr/bin/aws-cli", false)).not.toThrow();
    expect(() => buildCliWrapperScript("git_lfs", "/usr/bin/git_lfs", false)).not.toThrow();
    expect(() => buildCliWrapperScript("node18", "/usr/bin/node18", false)).not.toThrow();
    expect(() => buildCliWrapperScript("a.out", "/tmp/a.out", false)).not.toThrow();
  });
});

describe("buildDenyPatternsFile", () => {
  test("emits patterns one per line with trailing newline, no escaping", () => {
    const file = buildDenyPatternsFile(["rm -rf *", 'foo$(id)*', "echo `whoami`"]);
    expect(file).toBe("rm -rf *\nfoo$(id)*\necho `whoami`\n");
  });
});

describe("SAFE_CMD_NAME", () => {
  test("rejects shell metacharacters", () => {
    for (const bad of ["$(id)", "`id`", "rm;ls", "rm|ls", "rm&", "rm>x", "a b", "*", "../rm", "rm$X"]) {
      expect(SAFE_CMD_NAME.test(bad)).toBe(false);
    }
  });

  test("accepts conventional identifiers", () => {
    for (const ok of ["ls", "git", "gh", "git-lfs", "git_lfs", "a.out", "node18"]) {
      expect(SAFE_CMD_NAME.test(ok)).toBe(true);
    }
  });
});
