import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const originalSpawnSync = Bun.spawnSync;

(Bun as any).spawnSync = ((cmd: string[], opts?: any) => {
  if (cmd[0] === "id" && cmd[2] === "band-runner") {
    return {
      exitCode: 0,
      stdout: Buffer.from("1000\n"),
      stderr: Buffer.from(""),
    };
  }
  return originalSpawnSync(cmd as any, opts);
}) as typeof Bun.spawnSync;

afterAll(() => {
  (Bun as any).spawnSync = originalSpawnSync;
});

const { buildSecretEnvLines } = await import(
  `../../src/band-server.ts?test=${Date.now()}`
);

describe("band-server secret env", () => {
  test("reads secrets from files without embedding values or base64 subprocesses", () => {
    const lines = buildSecretEnvLines("/tmp/band-exec-test", {
      API_KEY: "super-secret",
    });

    expect(lines).toEqual([
      `IFS= read -r -d '' API_KEY < "/tmp/band-exec-test/secrets/API_KEY" || true`,
      "export API_KEY",
    ]);
    expect(lines.join("\n")).not.toContain("super-secret");
    expect(lines.join("\n")).not.toContain("base64");
    expect(lines.join("\n")).not.toContain("$(");
  });

  test("generated env lines export multiline secret file contents", () => {
    const workdir = mkdtempSync(join(tmpdir(), "band-secret-env-"));
    try {
      mkdirSync(join(workdir, "secrets"));
      const secret = "top secret\nsecond line";
      writeFileSync(join(workdir, "secrets", "API_KEY"), secret);

      const script = [
        ...buildSecretEnvLines(workdir, { API_KEY: secret }),
        `printf '%s' "$API_KEY"`,
      ].join("\n");
      const proc = Bun.spawnSync(["bash", "-c", script]);

      expect(proc.exitCode).toBe(0);
      expect(proc.stdout.toString()).toBe(secret);
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });

  test("rejects invalid secret names before writing env lines", () => {
    expect(() =>
      buildSecretEnvLines("/tmp/band-exec-test", { "BAD/KEY": "secret" })
    ).toThrow("Invalid secret name: BAD/KEY");
  });
});
