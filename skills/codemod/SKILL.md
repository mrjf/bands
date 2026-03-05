---
name: codemod
description: Automated code transformations across codebases. Use this skill when users want to rename functions,
  variables, or types across files, migrate API usage patterns, update import paths, convert between code styles
  (e.g. callbacks to async/await, class components to hooks), apply consistent formatting changes, or perform any
  repetitive code modification that spans multiple files. Triggers on requests like "rename X to Y everywhere",
  "migrate from old API to new API", "convert all X to Y", or "refactor across the codebase".
---

# Skill: codemod

Automated code transformations across codebases. Apply consistent, reliable code changes at scale.

## Instructions

### Workflow

Every codemod follows this sequence:

1. **Scope** - Identify target files and the transformation
2. **Dry run** - Preview changes without writing
3. **Apply** - Execute the transformation
4. **Verify** - Confirm correctness

Never skip the dry run. Always show the user what will change before writing.

### Choosing a Strategy

Pick the simplest strategy that handles the transformation correctly:

| Strategy | When to use | Tool |
|----------|-------------|------|
| **Text replace** | Literal string swaps, no syntax awareness needed | `sed`, `grep` + `edit` |
| **Regex transform** | Pattern-based changes with captures | `sed -E`, Python `re` |
| **AST transform** | Syntax-aware changes, must preserve correctness | jscodeshift, libcst, ts-morph |

Default to text/regex. Escalate to AST only when the transform requires understanding code structure (e.g., renaming only function calls but not string literals containing the same name, or reordering function arguments).

### Text & Regex Transforms

For simple renames and pattern swaps, use the edit tool directly with glob to find files:

```
1. glob **/*.ts to find target files
2. grep "oldName" to confirm scope
3. edit each file: oldName -> newName
```

For regex patterns across many files, use sed in dry-run mode first:

```bash
# Dry run - preview changes
grep -rl "oldPattern" --include="*.ts" src/ | head -20
sed -n 's/oldPattern/newPattern/gp' src/example.ts

# Apply
find src -name "*.ts" -exec sed -i '' 's/oldPattern/newPattern/g' {} +
```

Common regex patterns:

```bash
# Rename function/variable (word boundary)
's/\boldName\b/newName/g'

# Update import paths
's|from ["'\'']\./old/path["'\'']|from "./new/path"|g'

# Convert string concatenation to template literals (simple cases)
's/"\s*\+\s*(\w+)\s*\+\s*"/`${\1}`/g'

# Add/remove optional chaining
's/(\w+)\.(\w+)/\1?.\2/g'
```

### AST Transforms (JavaScript/TypeScript)

Use jscodeshift when text replacement would cause incorrect changes.

```bash
# Install
npm install -g jscodeshift

# Dry run
jscodeshift --dry --print -t transform.js src/

# Apply
jscodeshift -t transform.js src/
```

Write transform files following this pattern:

```javascript
// transform.js
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Find and transform
  root.find(j.CallExpression, {
    callee: { name: 'oldFunction' }
  }).forEach(path => {
    path.node.callee.name = 'newFunction';
  });

  return root.toSource({ quote: 'single' });
};
```

Common jscodeshift transforms:

```javascript
// Rename identifiers
root.find(j.Identifier, { name: 'old' })
  .forEach(p => { p.node.name = 'new'; });

// Change member expressions: obj.old() -> obj.new()
root.find(j.MemberExpression, {
  property: { name: 'oldMethod' }
}).forEach(p => { p.node.property.name = 'newMethod'; });

// Add argument to function calls
root.find(j.CallExpression, {
  callee: { name: 'myFunc' }
}).forEach(p => {
  p.node.arguments.push(j.identifier('newArg'));
});

// Wrap expression: x -> wrapper(x)
root.find(j.CallExpression, {
  callee: { name: 'target' }
}).replaceWith(p =>
  j.callExpression(j.identifier('wrapper'), [p.node])
);
```

### AST Transforms (Python)

Use libcst for Python AST transforms:

```bash
pip install libcst
```

```python
import libcst as cst

class RenameTransformer(cst.CSTTransformer):
    def leave_Name(self, original, updated):
        if updated.value == "old_name":
            return updated.with_changes(value="new_name")
        return updated

source = open("module.py").read()
tree = cst.parse_module(source)
modified = tree.visit(RenameTransformer())
print(modified.code)
```

### Multi-file Orchestration

For large-scale transforms, batch the work:

```bash
# 1. Collect targets
grep -rl "pattern" --include="*.ts" src/ > /tmp/targets.txt
echo "Found $(wc -l < /tmp/targets.txt) files"

# 2. Preview a sample
head -5 /tmp/targets.txt | while read f; do
  echo "=== $f ==="
  sed -n 's/old/new/gp' "$f"
done

# 3. Apply to all
cat /tmp/targets.txt | while read f; do
  sed -i '' 's/old/new/g' "$f"
done

# 4. Verify
grep -rl "old" --include="*.ts" src/ | wc -l  # should be 0
```

### Verification Checklist

After applying a codemod, verify:

1. **No remaining occurrences** - `grep -r "oldPattern"` returns nothing
2. **No syntax errors** - run the project's linter or type checker
3. **Tests pass** - run the project's test suite if available
4. **Diff review** - show `git diff --stat` summary to the user

### Edge Cases to Watch

- **String literals**: Text replace may hit strings/comments unintentionally. Use word boundaries or AST.
- **Dynamic references**: `obj[varName]` won't be caught by static transforms. Flag these.
- **Generated files**: Skip `node_modules/`, `dist/`, `.git/`, lock files. Always exclude build artifacts.
- **Encoding**: Ensure sed/tools handle UTF-8. Use `LC_ALL=C` if needed.
- **Case sensitivity**: Decide upfront if the rename is case-sensitive. Document the choice.

### File Exclusion Defaults

Always exclude these from transforms:

```
node_modules/  dist/  build/  .git/  *.lock  *.min.js  *.min.css
vendor/  __pycache__/  .next/  .nuxt/  coverage/
```
