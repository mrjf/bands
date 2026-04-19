// Band shell
export {
  isCommandAllowed,
  executeCommand,
  runCommand,
  loadBandConfig,
  startInteractiveShell,
  runScriptMode,
} from "./band-shell";
export type { BandShellConfig, CommandResult } from "./band-shell";

// Skills integration
export {
  fetchSkill,
  parseSkillMd,
  generateSkillBand,
  generateSkillSystemPrompt,
  executeSkill,
  createSkillContext,
} from "./skills";

// Banded skills
export {
  discoverBandForScript,
  validateBandedSkill,
  bandExec,
  parseExecArgs,
  printHelp,
  generateWrapper,
  generateSparseSKILLMd,
  generatePerScriptBand,
  convertToBandedSkill,
} from "./banded-skills";
export type {
  BandedScript,
  BandedSkill,
  BandedSkillValidationResult,
  BandExecOptions,
  BandExecResult,
  DiscoveryResult,
  ConvertOptions,
  ConvertResult,
} from "./banded-skills";

// Executors
export {
  executeBand,
  getExecutor,
  listAvailableTargets,
  isTargetAvailable,
} from "./executors";

export type {
  SkillFrontmatter,
  LoadedSkill,
  SkillScript,
  SkillExecutionResult,
  SkillContext,
  ParsedSkillMd,
  GenerateBandOptions,
} from "./skills";
