# @bands/format

Parse, validate, and manipulate BAND.md configuration files.

## Usage

```typescript
import { parseBandMd, exportBandMd, validate } from "@bands/format";

// Parse YAML frontmatter
const { document, errors } = parseBandMd(yamlContent);

// Validate
const validationErrors = validate(document);

// Export back to YAML
const yaml = exportBandMd(document);
```

## API

### Parsing & Export

| Function | Description |
|----------|-------------|
| `parseBandMd(content)` | Parse BAND.md YAML frontmatter into a document |
| `exportBandMd(document)` | Serialize a document back to YAML |
| `validate(document)` | Validate a parsed document, returns errors |

### Permission Checking

| Function | Description |
|----------|-------------|
| `checkPermission(value, allow, deny)` | Check if a value is permitted |
| `checkCliPermission(cmd, band)` | Check CLI command permission |
| `checkReadPermission(path, band)` | Check file read permission |
| `checkWritePermission(path, band)` | Check file write permission |
| `checkNetPermission(url, band)` | Check network egress permission |

### Glob Matching

| Function | Description |
|----------|-------------|
| `globToRegex(pattern)` | Convert a glob pattern to a RegExp |
| `matchGlob(value, pattern)` | Test if a value matches a glob pattern |
| `matchAnyGlob(value, patterns)` | Test if a value matches any pattern in an array |

### Normalization

| Function | Description |
|----------|-------------|
| `normalize(document)` | Normalize a document (canonical key order, sorted arrays, deep clone) |

### Composition

| Function | Description |
|----------|-------------|
| `union(a, b)` | Merge two permission sets (union) |
| `intersect(a, b)` | Intersect two permission sets |
| `removeItems(set, items)` | Remove items from a permission set |
| `computeEffective(document)` | Resolve extends/includes chains |
| `resolve(document)` | Resolve all references |
| `detectConflicts(document)` | Find permission conflicts |

### References

| Function | Description |
|----------|-------------|
| `parseGitHubUrl(url)` | Parse a GitHub URL into owner/repo/path |
| `isValidGitHubUrl(url)` | Check if a URL is a valid GitHub URL |
| `parseSkillRef(ref)` | Parse a skill reference string |
| `normalizeSkillRef(ref)` | Normalize a skill reference |
| `detectBandReference(value)` | Detect if a value is a band reference |
| `resolveBandReference(ref)` | Resolve a band reference to content |
| `isBandReference(value)` | Check if a value is a band reference |

### Units

| Function | Description |
|----------|-------------|
| `parseBytes(value)` | Parse `"1mb"` → `1048576` |
| `formatBytes(n)` | Format `1048576` → `"1mb"` |
| `parseDuration(value)` | Parse `"30s"` → `30000` |
| `formatDuration(ms)` | Format `30000` → `"30s"` |
| `parseCost(value)` | Parse `"1.50"` → `1.5` |
| `formatCost(n)` | Format `1.5` → `"1.50"` |

### Constants

`REQUIRED_FIELDS`, `ALLOWED_TOP_LEVEL_KEYS`, `PERMISSION_CATEGORIES`, `PERMISSION_COLUMNS`, `LIMIT_FIELDS`, `ENV_FIELDS`, `EXECUTION_TARGETS`
