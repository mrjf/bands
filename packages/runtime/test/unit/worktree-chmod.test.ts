/**
 * Tests for worktree-chmod sandbox module.
 *
 * These test the pure logic (plan generation, script building, traversal
 * computation) without any VM, git, or filesystem.
 */

import { describe, test, expect } from "bun:test";
import {
  computeTraversalDirs,
  filterUnsafeSymlinks,
  buildChmodPlan,
  buildChmodScript,
  buildSparseCheckoutPatterns,
  buildWorktreeSetupScript,
  buildWorktreeTeardownScript,
  shellQuote,
  isPathSafe,
} from "../../src/worktree-chmod";

describe("computeTraversalDirs", () => {
  test("single file produces chain of parent dirs", () => {
    const dirs = computeTraversalDirs(["/wt/src/deep/file.ts"], "/wt");
    expect(dirs).toContain("/wt");
    expect(dirs).toContain("/wt/src");
    expect(dirs).toContain("/wt/src/deep");
    expect(dirs).not.toContain("/wt/src/deep/file.ts");
  });

  test("file at root produces only root", () => {
    const dirs = computeTraversalDirs(["/wt/file.ts"], "/wt");
    expect(dirs).toEqual(["/wt"]);
  });

  test("multiple files in same dir deduplicate", () => {
    const dirs = computeTraversalDirs(
      ["/wt/src/a.ts", "/wt/src/b.ts"],
      "/wt"
    );
    const srcCount = dirs.filter((d) => d === "/wt/src").length;
    expect(srcCount).toBe(1);
  });

  test("files at different depths produce correct union", () => {
    const dirs = computeTraversalDirs(
      ["/wt/a.ts", "/wt/src/deep/b.ts"],
      "/wt"
    );
    expect(dirs).toContain("/wt");
    expect(dirs).toContain("/wt/src");
    expect(dirs).toContain("/wt/src/deep");
  });

  test("sorted shortest-first", () => {
    const dirs = computeTraversalDirs(
      ["/wt/a/b/c/d.ts"],
      "/wt"
    );
    for (let i = 1; i < dirs.length; i++) {
      expect(dirs[i].length).toBeGreaterThanOrEqual(dirs[i - 1].length);
    }
  });

  test("empty files list returns only root", () => {
    const dirs = computeTraversalDirs([], "/wt");
    expect(dirs).toEqual(["/wt"]);
  });
});

describe("filterUnsafeSymlinks", () => {
  test("non-symlink files are safe", () => {
    const { safe, unsafe } = filterUnsafeSymlinks(
      ["/wt/file.ts"],
      "/wt",
      () => null
    );
    expect(safe).toEqual(["/wt/file.ts"]);
    expect(unsafe).toEqual([]);
  });

  test("symlink inside worktree is safe", () => {
    const { safe, unsafe } = filterUnsafeSymlinks(
      ["/wt/link.ts"],
      "/wt",
      (path) => (path === "/wt/link.ts" ? "./real.ts" : null)
    );
    expect(safe).toEqual(["/wt/link.ts"]);
    expect(unsafe).toEqual([]);
  });

  test("symlink outside worktree is unsafe", () => {
    const { safe, unsafe } = filterUnsafeSymlinks(
      ["/wt/link.ts"],
      "/wt",
      (path) => (path === "/wt/link.ts" ? "/etc/passwd" : null)
    );
    expect(safe).toEqual([]);
    expect(unsafe).toEqual(["/wt/link.ts"]);
  });

  test("mixed safe and unsafe", () => {
    const { safe, unsafe } = filterUnsafeSymlinks(
      ["/wt/good.ts", "/wt/bad.ts", "/wt/normal.ts"],
      "/wt",
      (path) => {
        if (path === "/wt/bad.ts") return "/etc/shadow";
        if (path === "/wt/good.ts") return "./other.ts";
        return null;
      }
    );
    expect(safe).toEqual(["/wt/good.ts", "/wt/normal.ts"]);
    expect(unsafe).toEqual(["/wt/bad.ts"]);
  });
});

describe("buildChmodPlan", () => {
  test("single readable file", () => {
    const plan = buildChmodPlan("/wt", ["/wt/data/file.csv"], [], []);
    expect(plan.worktreeRoot).toBe("/wt");
    expect(plan.readableFiles).toEqual(["/wt/data/file.csv"]);
    expect(plan.writableFiles).toEqual([]);
    expect(plan.deniedFiles).toEqual([]);
    expect(plan.traversalDirs).toContain("/wt");
    expect(plan.traversalDirs).toContain("/wt/data");
  });

  test("single writable file", () => {
    const plan = buildChmodPlan("/wt", [], ["/wt/output/result.json"], []);
    expect(plan.writableFiles).toEqual(["/wt/output/result.json"]);
    expect(plan.traversalDirs).toContain("/wt/output");
  });

  test("mixed read and write", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/data/input.csv"],
      ["/wt/output/result.json"],
      []
    );
    expect(plan.readableFiles).toEqual(["/wt/data/input.csv"]);
    expect(plan.writableFiles).toEqual(["/wt/output/result.json"]);
    expect(plan.traversalDirs).toContain("/wt/data");
    expect(plan.traversalDirs).toContain("/wt/output");
  });

  test("deny overrides in plan", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/data/file.csv", "/wt/data/.env"],
      [],
      ["/wt/data/.env"]
    );
    expect(plan.readableFiles).toContain("/wt/data/file.csv");
    expect(plan.readableFiles).toContain("/wt/data/.env");
    expect(plan.deniedFiles).toEqual(["/wt/data/.env"]);
  });

  test("empty patterns produce empty plan", () => {
    const plan = buildChmodPlan("/wt", [], [], []);
    expect(plan.readableFiles).toEqual([]);
    expect(plan.writableFiles).toEqual([]);
    expect(plan.deniedFiles).toEqual([]);
    expect(plan.lockdownDirs).toEqual(["/wt"]);
  });

  test("deduplicates files in read and write", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/file.ts", "/wt/file.ts"],
      ["/wt/file.ts"],
      []
    );
    // traversalDirs should not have duplicates
    const unique = new Set(plan.traversalDirs);
    expect(unique.size).toBe(plan.traversalDirs.length);
  });
});

describe("buildChmodScript", () => {
  test("correct phase ordering", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/data/file.csv"],
      ["/wt/output/result.json"],
      ["/wt/data/.env"]
    );
    const script = buildChmodScript(plan);

    const phase1 = script.indexOf("chmod -R 000");
    const phase2 = script.indexOf("chmod a+x");
    const phase3 = script.indexOf("chmod a+r ");
    const phase4 = script.indexOf("chmod a+rw");
    const phase5 = script.lastIndexOf("chmod 000 ");

    // All phases present
    expect(phase1).toBeGreaterThan(-1);
    expect(phase2).toBeGreaterThan(-1);
    expect(phase3).toBeGreaterThan(-1);
    expect(phase4).toBeGreaterThan(-1);
    expect(phase5).toBeGreaterThan(-1);

    // Correct order: lockdown → traversal → read → write → deny
    expect(phase1).toBeLessThan(phase2);
    expect(phase2).toBeLessThan(phase3);
    expect(phase3).toBeLessThan(phase4);
    expect(phase4).toBeLessThan(phase5);
  });

  test("no a+r on traversal directories", () => {
    const plan = buildChmodPlan("/wt", ["/wt/src/deep/file.ts"], [], []);
    const script = buildChmodScript(plan);

    // Traversal dirs should only get a+x
    const lines = script.split("\n");
    const traversalLines = lines.filter((l) => l.includes("Phase 2") || (l.includes("chmod a+x") && !l.includes("a+r")));
    expect(traversalLines.length).toBeGreaterThan(0);

    // No a+r on directories (only on files in Phase 3)
    for (const dir of plan.traversalDirs) {
      const dirReadLine = lines.find((l) => l.includes(`chmod a+r`) && l.includes(`'${dir}'`) && !l.includes("a+rw"));
      expect(dirReadLine).toBeUndefined();
    }
  });

  test("empty plan has lockdown and root traversal only", () => {
    const plan = buildChmodPlan("/wt", [], [], []);
    const script = buildChmodScript(plan);
    expect(script).toContain("chmod -R 000");
    expect(script).toContain("chmod a+x '/wt'");
    expect(script).not.toContain("chmod a+r ");
    expect(script).not.toContain("chmod a+rw");
  });

  test("deny phase comes after allow phases", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/data/.env"],
      [],
      ["/wt/data/.env"]
    );
    const script = buildChmodScript(plan);

    // The allow (a+r) comes before the deny (000)
    const allowIdx = script.indexOf("chmod a+r");
    const denyIdx = script.lastIndexOf("chmod 000 ");
    expect(allowIdx).toBeLessThan(denyIdx);
  });
});

describe("shellQuote", () => {
  test("simple string", () => {
    expect(shellQuote("/wt/file.ts")).toBe("'/wt/file.ts'");
  });

  test("string with spaces", () => {
    expect(shellQuote("/wt/my file.ts")).toBe("'/wt/my file.ts'");
  });

  test("string with single quotes", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  test("string with special chars", () => {
    const quoted = shellQuote("$(rm -rf /)");
    expect(quoted).toBe("'$(rm -rf /)'");
  });

  test("string with newlines", () => {
    const quoted = shellQuote("line1\nline2");
    expect(quoted).toBe("'line1\nline2'");
  });
});

describe("isPathSafe", () => {
  test("path inside worktree is safe", () => {
    expect(isPathSafe("src/file.ts", "/wt")).toBe(true);
  });

  test("path traversal is unsafe", () => {
    expect(isPathSafe("../../etc/passwd", "/wt")).toBe(false);
  });

  test("absolute path outside worktree is unsafe", () => {
    expect(isPathSafe("/etc/passwd", "/wt")).toBe(false);
  });

  test("null byte is unsafe", () => {
    expect(isPathSafe("file\0.ts", "/wt")).toBe(false);
  });

  test("worktree root itself is safe", () => {
    expect(isPathSafe(".", "/wt")).toBe(true);
  });

  test("deeply nested path is safe", () => {
    expect(isPathSafe("a/b/c/d/e/f.ts", "/wt")).toBe(true);
  });
});

describe("buildSparseCheckoutPatterns", () => {
  test("simple file paths extract directory", () => {
    const patterns = buildSparseCheckoutPatterns(
      ["./data/input.csv"],
      ["./output/result.json"]
    );
    expect(patterns).toContain("data");
    expect(patterns).toContain("output");
  });

  test("glob patterns extract prefix directory", () => {
    const patterns = buildSparseCheckoutPatterns(
      ["./src/**/*.ts"],
      []
    );
    expect(patterns).toContain("src");
  });

  test("root-level glob produces wildcard", () => {
    const patterns = buildSparseCheckoutPatterns(["*.json"], []);
    expect(patterns).toContain("*");
  });

  test("deduplicates overlapping patterns", () => {
    const patterns = buildSparseCheckoutPatterns(
      ["./src/a.ts", "./src/b.ts"],
      ["./src/c.ts"]
    );
    const srcCount = patterns.filter((p) => p === "src").length;
    expect(srcCount).toBe(1);
  });

  test("strips leading ./", () => {
    const patterns = buildSparseCheckoutPatterns(["./data/file.csv"], []);
    expect(patterns).not.toContain("./data");
    expect(patterns).toContain("data");
  });
});

describe("buildWorktreeSetupScript", () => {
  test("generates valid setup script", () => {
    const script = buildWorktreeSetupScript("/repo", "/tmp/wt-123", ["src", "data"]);
    expect(script).toContain("git -C '/repo' worktree add --detach '/tmp/wt-123'");
    expect(script).toContain("git sparse-checkout init --cone");
    expect(script).toContain("git sparse-checkout set 'src' 'data'");
  });

  test("wildcard pattern skips sparse-checkout set", () => {
    const script = buildWorktreeSetupScript("/repo", "/tmp/wt-123", ["*"]);
    expect(script).toContain("sparse-checkout init");
    expect(script).not.toContain("sparse-checkout set");
  });
});

describe("buildWorktreeTeardownScript", () => {
  test("restores permissions before removal", () => {
    const script = buildWorktreeTeardownScript("/repo", "/tmp/wt-123");
    const chmodIdx = script.indexOf("chmod -R u+rwx");
    const removeIdx = script.indexOf("worktree remove");
    expect(chmodIdx).toBeGreaterThan(-1);
    expect(removeIdx).toBeGreaterThan(-1);
    expect(chmodIdx).toBeLessThan(removeIdx);
  });

  test("has rm -rf fallback", () => {
    const script = buildWorktreeTeardownScript("/repo", "/tmp/wt-123");
    expect(script).toContain("rm -rf");
  });
});

describe("security invariants", () => {
  test("file outside all patterns is not in plan", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/data/allowed.csv"],
      [],
      []
    );
    expect(plan.readableFiles).not.toContain("/wt/secrets/key.pem");
    expect(plan.writableFiles).not.toContain("/wt/secrets/key.pem");
  });

  test("deny pattern overrides allow in plan ordering", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/data/config.json", "/wt/data/.env"],
      [],
      ["/wt/data/.env"]
    );
    const script = buildChmodScript(plan);

    // .env gets a+r in phase 3 then 000 in phase 5
    const readLine = script.indexOf("chmod a+r '/wt/data/.env'");
    const denyLine = script.indexOf("chmod 000 '/wt/data/.env'");
    expect(readLine).toBeGreaterThan(-1);
    expect(denyLine).toBeGreaterThan(-1);
    expect(readLine).toBeLessThan(denyLine);
  });

  test("no directory gets a+w", () => {
    const plan = buildChmodPlan(
      "/wt",
      [],
      ["/wt/output/file.txt"],
      []
    );
    const script = buildChmodScript(plan);
    const lines = script.split("\n");

    // Only the file itself should get a+rw, not the directory
    for (const dir of plan.traversalDirs) {
      const writeLine = lines.find((l) => l.includes("chmod a+rw") && l.includes(`'${dir}'`));
      expect(writeLine).toBeUndefined();
    }
  });

  test("worktree root gets a+x but not a+r", () => {
    const plan = buildChmodPlan("/wt", ["/wt/src/file.ts"], [], []);
    const script = buildChmodScript(plan);

    // Root should have a+x for traversal
    expect(script).toContain("chmod a+x '/wt'");
    // But NOT a+r (no directory listing)
    const lines = script.split("\n");
    const rootReadLine = lines.find(
      (l) => l.match(/chmod a\+r\b/) && l.includes("'/wt'") && !l.includes("a+rw")
    );
    expect(rootReadLine).toBeUndefined();
  });

  test("shellQuote prevents injection in generated script", () => {
    const plan = buildChmodPlan(
      "/wt",
      ["/wt/$(whoami)/file.ts"],
      [],
      []
    );
    const script = buildChmodScript(plan);
    // The dangerous path should be inside single quotes in the script
    expect(script).toContain("'/wt/$(whoami)/file.ts'");
    // Should not appear unquoted
    const lines = script.split("\n");
    for (const line of lines) {
      if (line.includes("$(whoami)")) {
        expect(line).toMatch(/'/);
      }
    }
  });
});
