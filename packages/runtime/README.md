# @bands/runtime

Execute bands across different isolation targets. Provides the CLI, executors, and skill system.

## Usage

```typescript
import { compileBand, bandExec } from "@bands/runtime";

// Execute a band
const band = compileBand(bandMdContent);
const result = await executeBand(band, payload, { target: "local-lima" });
```

## API

### Core

| Function | Description |
|----------|-------------|
| `compileBand(content)` | Parse and compile a band configuration |
| `createBandServer(options)` | Create the HTTP enforcement server |
| `createRestrictedFetch(band)` | Create a fetch function restricted by band permissions |
| `checkEgress(url, band)` | Check if a URL is allowed by network permissions |
| `validateInput(data, schema)` | Validate input against a schema |
| `validateOutput(data, schema)` | Validate output against a schema |
| `checkTimeout(startTime, limit)` | Check if execution has exceeded timeout |

### Band Shell

| Function | Description |
|----------|-------------|
| `isCommandAllowed(cmd, band)` | Check if a shell command is permitted |
| `executeCommand(cmd, band)` | Execute a command within band constraints |
| `runCommand(cmd, options)` | Run a shell command |
| `loadBandConfig(path)` | Load band configuration from file |
| `startInteractiveShell(band)` | Start an interactive shell with band enforcement |
| `runScriptMode(script, band)` | Run a script with band enforcement |

### Skills

| Function | Description |
|----------|-------------|
| `fetchSkill(source)` | Fetch a skill from a URL or local path |
| `parseSkillMd(content)` | Parse SKILL.md frontmatter and body |
| `generateSkillBand(skill)` | Generate a band from a skill |
| `generateSkillSystemPrompt(skill)` | Generate an agent system prompt from a skill |
| `executeSkill(skill, request)` | Execute a skill with a request |
| `createSkillContext(skill)` | Create an execution context for a skill |

### Banded Skills

| Function | Description |
|----------|-------------|
| `bandExec(options)` | Execute a banded script |
| `parseExecArgs(argv)` | Parse CLI arguments for exec |
| `printHelp(resourceDir)` | Print schema help for a script |
| `discoverBandForScript(skillRoot, scriptName)` | Find the band config for a script |
| `validateBandedSkill(skillDir)` | Validate a banded skill directory |
| `convertToBandedSkill(source, options)` | Convert a skill to banded format |
| `generateWrapper(scriptName)` | Generate a wrapper script |
| `generateSparseSKILLMd(skill)` | Generate a SKILL.md from parsed skill |
| `generatePerScriptBand(scriptName)` | Generate a per-script BAND.md |

### Error Codes

| Export | Description |
|--------|-------------|
| `ErrorCodes` | Standard error code constants (`INPUT_TOO_LARGE`, `OUTPUT_TOO_LARGE`, `TIMEOUT`, `COST_EXCEEDED`, `EGRESS_DENIED`, `INTERNAL_ERROR`, `NOT_READY`) |

### Types

```typescript
interface BandExecOptions {
  resourceDir: string;          // Path to scripts/resources/<name>/
  args: Record<string, string>; // CLI arguments
  inputPath?: string;           // Path to input JSON file
  outputPath?: string;          // Path to write output
  help?: boolean;               // Show help instead of executing
  skillRoot?: string;           // Skill root for band discovery
  forceLima?: boolean;          // Force Lima VM, reject local-dangerously
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
