import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildCliWrapperScript, buildDenyPatternsFile } from "../../src/cli-wrapper";

describe("band-server CLI wrappers", () => {
  test("reads deny patterns so command substitutions are not executed", () => {
    const dir = mkdtempSync(join(tmpdir(), "band-wrapper-test-"));
    const marker = join(dir, "pwned");
    const realCmd = join(dir, "real-foo");
    const wrapperPath = join(dir, "foo");

    writeFileSync(realCmd, "#!/bin/bash\nexit 0\n");
    chmodSync(realCmd, 0o755);

    const pattern = "foo$(touch " + marker + ")*";
    const wrapper = buildCliWrapperScript("foo", realCmd, true);
    expect(wrapper).not.toContain("eval");
    expect(wrapper).not.toContain(pattern);
    expect(wrapper).toContain('if [[ "$FULL_CMD" == $P ]]; then');

    writeFileSync(wrapperPath, wrapper);
    writeFileSync(join(dir, ".deny-foo"), buildDenyPatternsFile([pattern]));
    chmodSync(wrapperPath, 0o755);

    const proc = Bun.spawnSync(["bash", wrapperPath, "safe"]);

    expect(proc.exitCode).toBe(0);
    expect(existsSync(marker)).toBe(false);
  });

  test("preserves shell metacharacters in deny patterns as side-file values", () => {
    const patterns = buildDenyPatternsFile([
      "foo *",
      "foo'bar*",
      "foo`echo pwned`*",
    ]);

    expect(patterns).toBe("foo *\nfoo'bar*\nfoo`echo pwned`*\n");
  });
});
