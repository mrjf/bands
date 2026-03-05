import { describe, expect, test } from "bun:test";
import {
  generateWrapper,
  generateSparseSKILLMd,
  generatePerScriptBand,
} from "../../../src/banded-skills/generator";

describe("generateWrapper", () => {
  test("generates 2-line bash wrapper", () => {
    const wrapper = generateWrapper("summarize-pr");
    expect(wrapper).toBe(
      '#!/bin/bash\nband exec scripts/resources/summarize-pr "$@"\n'
    );
  });

  test("handles hyphenated names", () => {
    const wrapper = generateWrapper("analyze-code-quality");
    expect(wrapper).toContain("analyze-code-quality");
    expect(wrapper).toStartWith("#!/bin/bash\n");
  });
});

describe("generateSparseSKILLMd", () => {
  test("generates valid SKILL.md with scripts", () => {
    const md = generateSparseSKILLMd("my-tool", "Does useful things", [
      "task-a",
      "task-b",
    ]);

    expect(md).toContain("name: my-tool");
    expect(md).toContain("description: Does useful things");
    expect(md).toContain("# my-tool");
    expect(md).toContain("## Available Scripts");
    expect(md).toContain("`task-a`");
    expect(md).toContain("`task-b`");
  });

  test("generates SKILL.md without scripts section when empty", () => {
    const md = generateSparseSKILLMd("empty-tool", "No scripts", []);

    expect(md).toContain("name: empty-tool");
    expect(md).not.toContain("## Available Scripts");
  });
});

describe("generatePerScriptBand", () => {
  test("generates restricted band for simple echo script", () => {
    const runSh = `#!/bin/bash
echo "hello"
cat "$INPUT_PATH"
`;
    const band = generatePerScriptBand("echo-test", runSh);

    expect(band.band).toBe("echo-test");
    expect(band.description).toContain("echo-test");
    expect(band.allow?.cli).toContain("echo *");
    expect(band.allow?.cli).toContain("cat *");
  });

  test("detects curl usage and adds net patterns", () => {
    const runSh = `#!/bin/bash
curl https://api.github.com/repos/owner/repo
`;
    const band = generatePerScriptBand("fetch-data", runSh);

    expect(band.allow?.cli).toContain("curl *");
    expect(band.allow?.net).toContain("api.github.com");
  });

  test("detects python usage", () => {
    const runSh = `#!/bin/bash
python3 -c "print('hello')"
`;
    const band = generatePerScriptBand("py-script", runSh);

    expect(band.allow?.cli).toContain("python3 *");
  });

  test("generates minimal band for empty script", () => {
    const band = generatePerScriptBand("empty", "");

    expect(band.band).toBe("empty");
    expect(band.allow).toBeUndefined();
  });

  test("detects piped commands", () => {
    const runSh = `#!/bin/bash
cat input.txt | grep "pattern" | sort | uniq
`;
    const band = generatePerScriptBand("pipeline", runSh);

    expect(band.allow?.cli).toContain("cat *");
    expect(band.allow?.cli).toContain("grep *");
    expect(band.allow?.cli).toContain("sort *");
    expect(band.allow?.cli).toContain("uniq *");
  });
});
