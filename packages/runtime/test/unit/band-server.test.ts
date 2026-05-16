import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

async function importBandServer() {
  const originalSpawnSync = Bun.spawnSync;
  (Bun as any).spawnSync = ((cmd: string[]) => {
    if (cmd[0] === "id" && (cmd[1] === "-u" || cmd[1] === "-g")) {
      return {
        exitCode: 0,
        stdout: Buffer.from("1000\n"),
        stderr: Buffer.from(""),
      };
    }
    return originalSpawnSync(cmd as any);
  }) as any;

  try {
    return await import(`../../src/band-server.ts?test=${Date.now()}`);
  } finally {
    (Bun as any).spawnSync = originalSpawnSync;
  }
}

describe("band-server CLI wrappers", () => {
  test("quotes deny patterns so command substitutions are not executed", async () => {
    const { buildCliWrapper } = await importBandServer();
    const dir = mkdtempSync(join(tmpdir(), "band-wrapper-test-"));
    const marker = join(dir, "pwned");
    const realCmd = join(dir, "real-foo");
    const wrapperPath = join(dir, "foo");

    writeFileSync(realCmd, "#!/bin/bash\nexit 0\n");
    chmodSync(realCmd, 0o755);

    const wrapper = buildCliWrapper("foo", realCmd, [`foo$(touch ${marker})*`]);
    expect(wrapper).not.toContain("eval");
    expect(wrapper).toContain('if [[ "$FULL_CMD" == $P ]]; then');

    writeFileSync(wrapperPath, wrapper);
    chmodSync(wrapperPath, 0o755);

    const proc = Bun.spawnSync(["bash", wrapperPath, "safe"]);

    expect(proc.exitCode).toBe(0);
    expect(existsSync(marker)).toBe(false);
  });

  test("preserves shell metacharacters in deny patterns as literal array values", async () => {
    const { buildCliWrapper } = await importBandServer();

    const wrapper = buildCliWrapper("foo", "/bin/true", [
      "foo *",
      "foo'bar*",
      "foo`echo pwned`*",
    ]);

    expect(wrapper).toContain("DENY_PATTERNS=('foo *' 'foo'\\''bar*' 'foo`echo pwned`*')");
  });
});
