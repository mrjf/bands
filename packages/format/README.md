# @bands/format

Parse, validate, and manipulate BAND.md configuration files.


## Usage

```typescript
import { parseBandMd, exportBandMd, validate } from "@bands/format";

const { document, errors } = parseBandMd(yamlContent);
const validationErrors = validate(document);
const yaml = exportBandMd(document);
```


## API

### Parsing and Export

| Function | Description |
|----------|-------------|
| `parseBandMd(content)` | Parse BAND.md YAML frontmatter into a document |
| `exportBandMd(document)` | Serialize a document back to YAML |
| `validate(document)` | Validate a parsed document, returns errors |

### Permission Checking

| Function | Description |
|----------|-------------|
| `checkPermission(value, allow, deny)` | Check if a value is permitted |
| `checkCliPermission(cmd, band)` | Check CLI command |
| `checkReadPermission(path, band)` | Check file read |
| `checkWritePermission(path, band)` | Check file write |
| `checkNetPermission(url, band)` | Check network egress |

### Glob Matching

| Function | Description |
|----------|-------------|
| `globToRegex(pattern)` | Convert glob to RegExp |
| `matchGlob(value, pattern)` | Test value against glob |
| `matchAnyGlob(value, patterns)` | Test value against pattern array |

### Normalization

| Function | Description |
|----------|-------------|
| `normalize(document)` | Canonical key order, sorted arrays, deep clone |

### Composition

| Function | Description |
|----------|-------------|
| `union(a, b)` | Merge two permission sets |
| `intersect(a, b)` | Intersect two permission sets |
| `removeItems(set, items)` | Remove items from a permission set |
| `computeEffective(document)` | Resolve extends/includes chains |
| `resolve(document)` | Resolve all references |
| `detectConflicts(document)` | Find permission conflicts |

### References

| Function | Description |
|----------|-------------|
| `parseGitHubUrl(url)` | Parse GitHub URL into owner/repo/path |
| `isValidGitHubUrl(url)` | Validate GitHub URL |
| `parseSkillRef(ref)` | Parse a skill reference |
| `normalizeSkillRef(ref)` | Normalize a skill reference |
| `detectBandReference(value)` | Detect band reference |
| `resolveBandReference(ref)` | Resolve band reference to content |
| `isBandReference(value)` | Check if value is a band reference |

### Units

| Function | Description |
|----------|-------------|
| `parseBytes(value)` | `"1mb"` to `1048576` |
| `formatBytes(n)` | `1048576` to `"1mb"` |
| `parseDuration(value)` | `"30s"` to `30000` |
| `formatDuration(ms)` | `30000` to `"30s"` |
| `parseCost(value)` | `"1.50"` to `1.5` |
| `formatCost(n)` | `1.5` to `"1.50"` |

### Constants

`REQUIRED_FIELDS`, `ALLOWED_TOP_LEVEL_KEYS`, `PERMISSION_CATEGORIES`, `PERMISSION_COLUMNS`, `LIMIT_FIELDS`, `ENV_FIELDS`, `EXECUTION_TARGETS`
