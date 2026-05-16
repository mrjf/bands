/**
 * CLI wrapper-script generation. Pure functions, no side effects.
 *
 * The band server creates a per-execution directory of small bash wrapper
 * scripts — one per allowed command. PATH is set to that directory inside the
 * sandbox, so only declared commands resolve. Each wrapper logs its
 * invocation, checks deny patterns, and execs the real binary.
 *
 * Security note: deny patterns originate from user-authored BAND.md files.
 * They must never be embedded into the wrapper script source. Bash array
 * literals and unquoted heredocs perform command substitution at parse time,
 * so a pattern like `foo$(id)*` would execute when the wrapper is generated.
 * Instead, patterns are written to a side file and read at run time with
 * `read -r`, which does no expansion. The match expression `[[ "$x" == $P ]]`
 * does glob matching on the value of P without re-parsing.
 */

/** Conventional command names: letters, digits, underscore, dash, dot. */
export const SAFE_CMD_NAME = /^[a-zA-Z0-9_.-]+$/;

export function buildCliWrapperScript(
  cmd: string,
  realPath: string,
  hasDeny: boolean
): string {
  if (!SAFE_CMD_NAME.test(cmd)) {
    throw new Error(`unsafe cmd name: ${cmd}`);
  }
  const logLine = `[ -n "\$BAND_OPS_FILE" ] && echo "${cmd} $*" >> "\$BAND_OPS_FILE"`;
  if (!hasDeny) {
    return `#!/bin/bash
${logLine}
exec ${realPath} "$@"
`;
  }
  return `#!/bin/bash
FULL_CMD="${cmd} $*"
while IFS= read -r P; do
  [ -z "\$P" ] && continue
  if [[ "\$FULL_CMD" == \$P ]]; then
    echo "DENIED: \$FULL_CMD" >&2
    exit 126
  fi
done < "\$(dirname "\$0")/.deny-${cmd}"
${logLine}
exec ${realPath} "$@"
`;
}

export function buildDenyPatternsFile(patterns: string[]): string {
  return patterns.join("\n") + "\n";
}
