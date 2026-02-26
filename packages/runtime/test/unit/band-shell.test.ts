import { describe, expect, test } from "bun:test";
import { isCommandAllowed, runCommand, type BandShellConfig } from "../../src/band-shell";

describe("band-shell", () => {
  describe("isCommandAllowed", () => {
    test("allows command matching allow pattern", () => {
      expect(isCommandAllowed("ls -la", ["ls *"], [])).toBe(true);
    });

    test("denies command not matching any allow pattern", () => {
      expect(isCommandAllowed("rm -rf /", ["ls *", "cat *"], [])).toBe(false);
    });

    test("denies command matching deny pattern even if allowed", () => {
      expect(isCommandAllowed("rm -rf /", ["*"], ["rm *"])).toBe(false);
    });

    test("allows command with slashes in arguments", () => {
      expect(isCommandAllowed("curl -s http://example.com/path", ["curl -s *"], [])).toBe(true);
    });

    test("denies POST curl even with generic curl allow", () => {
      expect(isCommandAllowed("curl -X POST http://example.com", ["curl *"], ["curl -X POST *"])).toBe(false);
    });

    test("allows exact command match", () => {
      expect(isCommandAllowed("python", ["python", "python *"], [])).toBe(true);
    });

    test("allows command with pattern match", () => {
      expect(isCommandAllowed("python script.py", ["python *"], [])).toBe(true);
    });

    test("denies command with no allow patterns", () => {
      expect(isCommandAllowed("ls", [], [])).toBe(false);
    });
  });

  describe("runCommand", () => {
    const config: BandShellConfig = {
      allow: ["echo *", "ls *"],
      deny: ["rm *"],
    };

    test("executes allowed command", async () => {
      const result = await runCommand("echo hello", config);
      expect(result.allowed).toBe(true);
      expect(result.stdout).toContain("hello");
      expect(result.code).toBe(0);
    });

    test("rejects denied command", async () => {
      const result = await runCommand("rm -rf /", config);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain("denied");
    });

    test("rejects command not in allow list", async () => {
      const result = await runCommand("curl http://example.com", config);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain("denied");
    });

    test("handles empty command", async () => {
      const result = await runCommand("", config);
      expect(result.allowed).toBe(true);
    });

    test("handles whitespace-only command", async () => {
      const result = await runCommand("   ", config);
      expect(result.allowed).toBe(true);
    });
  });

  describe("pattern edge cases", () => {
    test("** matches multiple path segments", () => {
      expect(isCommandAllowed("cat /a/b/c/d.txt", ["cat **"], [])).toBe(true);
    });

    test("? matches single character", () => {
      expect(isCommandAllowed("cat a.txt", ["cat ?.txt"], [])).toBe(true);
      expect(isCommandAllowed("cat ab.txt", ["cat ?.txt"], [])).toBe(false);
    });

    test("handles special regex characters in patterns", () => {
      expect(isCommandAllowed("cat file.txt", ["cat *.txt"], [])).toBe(true);
      expect(isCommandAllowed("cat file[1].txt", ["cat *[1].txt"], [])).toBe(true);
    });

    test("handles complex deny patterns", () => {
      const allow = ["curl *"];
      const deny = ["curl -X POST *", "curl -X PUT *", "curl -d *"];

      expect(isCommandAllowed("curl http://example.com", allow, deny)).toBe(true);
      expect(isCommandAllowed("curl -X POST http://example.com", allow, deny)).toBe(false);
      expect(isCommandAllowed("curl -d '{\"data\":1}' http://example.com", allow, deny)).toBe(false);
    });
  });
});
