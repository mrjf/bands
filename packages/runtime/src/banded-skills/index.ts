/**
 * Banded skills module.
 *
 * Provides discovery, validation, execution, generation, and conversion
 * of banded skills — sandboxed, script-based agent capabilities.
 */

// Types
export type {
  BandedScript,
  BandedSkill,
  BandedSkillValidationResult,
  BandedSkillValidationError,
  BandedSkillValidationWarning,
  BandExecOptions,
  BandExecResult,
} from "./types";

// Discovery
export { discoverBandForScript } from "./discovery";
export type { DiscoveryResult } from "./discovery";

// Validation
export { validateBandedSkill } from "./validator";

// Execution
export { bandExec, parseExecArgs, printHelp } from "./exec";

// Lima execution
export { limaExec } from "./lima-exec";

// Generator
export {
  generateWrapper,
  generateSparseSKILLMd,
  generatePerScriptBand,
  exportBandToString,
} from "./generator";

// Converter
export { convertToBandedSkill } from "./converter";
export type { ConvertOptions, ConvertResult } from "./converter";
