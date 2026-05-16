# @bands/runtime

Execute bands across isolation targets. Provides the CLI, executors, and skill system.


## Usage

```typescript
import { compileBand, bandExec } from "@bands/runtime";

const band = compileBand(bandMdContent);
const result = await executeBand(band, payload, { target: "local-lima" });
```


## API

### Core

| Function | Description |
|----------|-------------|
| `compileBand(content)` | Parse and compile a band configuration |
| `createBandServer(options)` | Create the HTTP enforcement server |
| `createRestrictedFetch(band)` | Fetch function restricted by band permissions |
| `checkEgress(url, band)` | Check URL against network permissions |
| `validateInput(data, schema)` | Validate input against schema |
| `validateOutput(data, schema)` | Validate output against schema |
| `checkTimeout(startTime, limit)` | Check timeout exceeded |

### Band Shell

| Function | Description |
|----------|-------------|
| `isCommandAllowed(cmd, band)` | Check if command is permitted |
| `executeCommand(cmd, band)` | Execute within band constraints |
| `runCommand(cmd, options)` | Run a shell command |
| `loadBandConfig(path)` | Load band config from file |
| `startInteractiveShell(band)` | Interactive shell with enforcement |
| `runScriptMode(script, band)` | Run script with enforcement |

### Skills

| Function | Description |
|----------|-------------|
| `fetchSkill(source)` | Fetch skill from URL or path |
| `parseSkillMd(content)` | Parse SKILL.md frontmatter and body |
| `generateSkillBand(skill)` | Generate band from skill |
| `generateSkillSystemPrompt(skill)` | Generate agent system prompt |
| `executeSkill(skill, request)` | Execute skill with request |
| `createSkillContext(skill)` | Create execution context |

### Banded Skills

| Function | Description |
|----------|-------------|
| `bandExec(options)` | Execute a banded script |
| `parseExecArgs(argv)` | Parse CLI arguments for exec |
| `printHelp(resourceDir)` | Print schema help |
| `discoverBandForScript(skillRoot, scriptName)` | Find band config for script |
| `validateBandedSkill(skillDir)` | Validate banded skill directory |
| `convertToBandedSkill(source, options)` | Convert skill to banded format |
| `generateWrapper(scriptName)` | Generate wrapper script |
| `generateSparseSKILLMd(skill)` | Generate SKILL.md from parsed skill |
| `generatePerScriptBand(scriptName)` | Generate per-script BAND.md |

### Error Codes

| Export | Description |
|--------|-------------|
| `ErrorCodes` | `INPUT_TOO_LARGE`, `OUTPUT_TOO_LARGE`, `TIMEOUT`, `COST_EXCEEDED`, `EGRESS_DENIED`, `INTERNAL_ERROR`, `NOT_READY` |

### Types

```typescript
interface BandExecOptions {
  resourceDir: string;
  args: Record<string, string>;
  inputPath?: string;
  outputPath?: string;
  help?: boolean;
  skillRoot?: string;
  forceLima?: boolean;          // Force Lima VM execution
}

interface BandExecResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metrics?: { durationMs: number };
}
```


## CLI

See [CLI Reference](../../docs/cli.md).
