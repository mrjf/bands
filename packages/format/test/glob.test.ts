import { describe, test, expect } from "bun:test";
import {
  globToRegex,
  matchGlob,
  checkCliPermission,
  checkReadPermission,
  checkWritePermission,
  checkNetPermission,
} from "../src/glob";

describe("globToRegex", () => {
  test("literal string", () => {
    const re = globToRegex("hello");
    expect(re.test("hello")).toBe(true);
    expect(re.test("hello world")).toBe(false);
    expect(re.test("hi")).toBe(false);
  });

  test("* matches any non-slash characters", () => {
    const re = globToRegex("*.txt");
    expect(re.test("file.txt")).toBe(true);
    expect(re.test("hello.txt")).toBe(true);
    expect(re.test(".txt")).toBe(true);
    expect(re.test("dir/file.txt")).toBe(false); // * doesn't match /
  });

  test("** matches anything including slashes", () => {
    const re = globToRegex("src/**/*.ts");
    expect(re.test("src/file.ts")).toBe(true);
    expect(re.test("src/deep/nested/file.ts")).toBe(true);
    expect(re.test("other/file.ts")).toBe(false);
  });

  test("? matches single character", () => {
    const re = globToRegex("file?.txt");
    expect(re.test("file1.txt")).toBe(true);
    expect(re.test("fileA.txt")).toBe(true);
    expect(re.test("file.txt")).toBe(false);
    expect(re.test("file12.txt")).toBe(false);
  });

  test("escapes regex special characters", () => {
    const re = globToRegex("file.txt");
    expect(re.test("file.txt")).toBe(true);
    expect(re.test("fileXtxt")).toBe(false); // . should be literal
  });
});

describe("CLI permission checks", () => {
  test("simple command allow", () => {
    expect(checkCliPermission("jq .", ["jq *"])).toBe(true);
    expect(checkCliPermission("jq .foo.bar", ["jq *"])).toBe(true);
    expect(checkCliPermission("curl http://x", ["jq *"])).toBe(false);
  });

  test("deny takes precedence", () => {
    expect(checkCliPermission("rm file.txt", ["rm *"], ["rm -rf *"])).toBe(true);
    expect(checkCliPermission("rm -rf /", ["rm *"], ["rm -rf *"])).toBe(false);
  });

  test("multiple allow patterns", () => {
    const allow = ["jq *", "cat *", "ls *"];
    expect(checkCliPermission("jq .", allow)).toBe(true);
    expect(checkCliPermission("cat file.txt", allow)).toBe(true);
    expect(checkCliPermission("ls -la", allow)).toBe(true);
    expect(checkCliPermission("curl x", allow)).toBe(false);
  });

  test("command with path", () => {
    expect(checkCliPermission("python scripts/run.py", ["python scripts/*.py"])).toBe(true);
    expect(checkCliPermission("python other/run.py", ["python scripts/*.py"])).toBe(false);
  });

  test("npm commands", () => {
    const allow = ["npm install", "npm run *", "npm test"];
    expect(checkCliPermission("npm install", allow)).toBe(true);
    expect(checkCliPermission("npm run build", allow)).toBe(true);
    expect(checkCliPermission("npm run dev", allow)).toBe(true);
    expect(checkCliPermission("npm test", allow)).toBe(true);
    expect(checkCliPermission("npm publish", allow)).toBe(false);
  });
});

describe("filesystem permission checks", () => {
  test("simple path allow", () => {
    expect(checkReadPermission("./src/index.ts", ["./src/**/*.ts"])).toBe(true);
    expect(checkReadPermission("./src/deep/file.ts", ["./src/**/*.ts"])).toBe(true);
    expect(checkReadPermission("./other/file.ts", ["./src/**/*.ts"])).toBe(false);
  });

  test("deny .env files", () => {
    const allow = ["./**/*"];
    const deny = ["**/.env", "**/.env.*"];
    expect(checkReadPermission("./src/index.ts", allow, deny)).toBe(true);
    expect(checkReadPermission("./.env", allow, deny)).toBe(false);
    expect(checkReadPermission("./config/.env", allow, deny)).toBe(false);
    expect(checkReadPermission("./.env.local", allow, deny)).toBe(false);
  });

  test("tmp directory", () => {
    expect(checkReadPermission("/tmp/file.txt", ["/tmp/**"])).toBe(true);
    expect(checkReadPermission("/tmp/deep/nested/file", ["/tmp/**"])).toBe(true);
    expect(checkReadPermission("/var/tmp/file", ["/tmp/**"])).toBe(false);
  });

  test("write permissions", () => {
    expect(checkWritePermission("/tmp/output.txt", ["/tmp/**"])).toBe(true);
    expect(checkWritePermission("./output/data.json", ["./output/**"])).toBe(true);
    expect(checkWritePermission("./src/index.ts", ["./output/**"])).toBe(false);
  });
});

describe("network permission checks", () => {
  test("exact host", () => {
    expect(checkNetPermission("api.github.com", ["api.github.com"])).toBe(true);
    expect(checkNetPermission("github.com", ["api.github.com"])).toBe(false);
  });

  test("wildcard subdomain", () => {
    expect(checkNetPermission("api.github.com", ["*.github.com"])).toBe(true);
    expect(checkNetPermission("raw.github.com", ["*.github.com"])).toBe(true);
    expect(checkNetPermission("github.com", ["*.github.com"])).toBe(false);
  });

  test("deny internal domains", () => {
    const allow = ["*"];
    const deny = ["*.internal.corp", "*.local"];
    expect(checkNetPermission("api.github.com", allow, deny)).toBe(true);
    expect(checkNetPermission("db.internal.corp", allow, deny)).toBe(false);
    expect(checkNetPermission("printer.local", allow, deny)).toBe(false);
  });
});
