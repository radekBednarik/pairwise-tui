---
name: pict
description: >
  Expert guidance for working with the PICT (Pairwise Independent Combinatorial Testing) binary.
  Use this skill whenever the user is designing, writing, integrating, or running PICT model files;
  invoking the pict binary from code or CLI; writing constraints, sub-models, aliases, seeds, or
  negative/weighted values; parsing PICT tab-separated output; wrapping pict in any language (Go,
  Python, TypeScript, etc.); debugging unexpected combinations; or building test-generation pipelines
  that call pict under the hood. Trigger even when the user only mentions "pairwise testing",
  "combinatorial test generation", "pict model", or "all-pairs" in the context of software development.
---

# PICT Skill

## What PICT Does

PICT (Pairwise Independent Combinatorial Testing) is a CLI binary that reads a plain-text **model file** and writes a compact, tab-separated set of test cases to **stdout**. The default strategy covers all **pairs** of parameter values (order 2), which research shows catches the overwhelming majority of defects at a fraction of the cost of exhaustive testing. Higher orders (`/o:3`, `/o:4`, …) can be specified for additional coverage.

**Binary:** `pict` (Linux/macOS) or `pict.exe` (Windows)  
**Source:** https://github.com/microsoft/pict  
**Releases:** https://github.com/microsoft/pict/releases  

---

## CLI Usage

```
pict <model_file> [options]

Options:
  /o:N|max   Order of combinations (default: 2)
  /d:C       Value separator in the model file (default: ,)
  /a:C       Alias separator (default: |)
  /n:C       Negative/out-of-range value prefix (default: ~)
  /e:file    Seeding rows file
  /r[:N]     Randomize; N = optional seed integer
  /c         Case-sensitive model evaluation
  /s         Show model statistics (to stderr)
```

**Output** goes to **stdout** (redirect to a file to get TSV).  
**Errors, warnings, and statistics** go to **stderr**.  
Same model + same options → deterministic output. Use `/r` for variation; the seed used is printed to stderr so you can replay it with `/r:<seed>`.

---

## Model File Syntax

### Basic Structure

```
# Comments start with #

<ParamName> : <Value1>, <Value2>, <Value3>, ...

[{ sub-model definitions }]

[constraint definitions]
```

Sections **must appear in this order**: parameters → sub-models → constraints.

### Minimal Example

```
# Disk partition model
Type:          Primary, Logical, Single, Span, Stripe, Mirror, RAID-5
Size:          10, 100, 500, 1000, 5000, 10000, 40000
Format method: quick, slow
File system:   FAT, FAT32, NTFS
Cluster size:  512, 1024, 2048, 4096, 8192, 16384, 32768, 65536
Compression:   on, off
```

Run: `pict model.txt` → prints header row + test case rows to stdout.

---

## Advanced Model Features

### Re-using Parameter Definitions

```
OS_1:   Win7, Win8, Win10
SKU_1:  Home, Pro
LANG_1: English, Spanish, Chinese

OS_2:   <OS_1>         # copies values from OS_1
SKU_2:  <SKU_1>
LANG_2: <LANG_1>, Hindi
```

### Sub-Models (Grouped Combinatorial Orders)

Bundle parameters that should be covered at a different order:

```
PLATFORM:  x86, x64, arm
CPUS:      1, 2, 4
RAM:       1GB, 4GB, 64GB
HDD:       SCSI, IDE
OS:        Win7, Win8, Win10
Browser:   Edge, Opera, Chrome, Firefox
APP:       Word, Excel, Powerpoint

{ PLATFORM, CPUS, RAM, HDD } @ 2   # hardware group at order 2
                                    # remaining params use /o value
```

- Sub-models are one level deep only.
- Order of a sub-model cannot exceed its parameter count.
- Omitting `@ N` uses the global `/o` value.

### Aliasing (Multiple Names for One Value)

```
SKU_1: Professional, Server | Datacenter
```

Names rotate in output. Only the **first** name is used in constraint evaluation and type detection.

### Negative / Out-of-Range Values (`~` prefix)

Mark a value invalid so it is never combined with another invalid value:

```
A: ~-1, 0, 1, 2
B: ~-1, 0, 1, 2
```

PICT guarantees every invalid value is paired with all valid values, but never with another invalid value (prevents input masking).

- The `~` shows up in output but is **stripped** for type detection and constraint evaluation.
- Override prefix with `/n:C`.

### Dummy Value Technique (Exclude Irrelevant Parameters)

When a parameter is meaningless under certain conditions, add an `NA` value and constrain it:

```
OS:            Windows, Ubuntu
DotNetVersion: 4.8, 4.8.1, NA

IF [OS] = "Ubuntu"
  THEN [DotNetVersion] = "NA"
  ELSE [DotNetVersion] <> "NA";
```

### Weighting (Bias Toward Certain Values)

```
Type:        Primary (10), Logical, Single
File system: FAT, FAT32, NTFS (10)
```

Weights are **hints**, not guarantees. PICT first optimises for coverage, then uses weights as a tiebreaker.

### Seeding (Fix Specific Combinations or Minimise Output Changes)

```
pict model.txt /e:seeds.txt
```

Seed file format (same as PICT output – tab-separated, first line = header):

```
Ver     SKU   Lang  Arch
Win7    Pro   EN    x86
Win7          FR    x86    # partial row – SKU chosen by PICT
Win10   Pro   EN    x64
```

Rules:
1. Unknown parameters in the seed file are ignored (with a warning).
2. Unknown values in a seed row are ignored; the row becomes partial.
3. Rows violating constraints are skipped entirely.

---

## Constraints

### Conditional

```
IF [File system] = "FAT"   THEN [Size] <= 4096;
IF [File system] = "FAT32" THEN [Size] <= 32000;
```

### Unconditional (Invariants)

```
[OS_1] <> [OS_2] OR [SKU_1] <> [SKU_2];
```

### Operators & Relations

| Category | Tokens |
|----------|--------|
| Relations | `=`, `<>`, `>`, `>=`, `<`, `<=` |
| Pattern match | `LIKE` (wildcards: `*` = any chars, `?` = one char) |
| Set membership | `IN { val1, val2, … }` |
| Logical | `AND`, `OR`, `NOT`, parentheses |
| Cross-param | `[Param1] = [Param2]` |

### Type System

- **Numeric** – all values parse as int or float → numeric comparisons allowed.
- **String** – any non-numeric value → string comparisons only.
- Types are auto-detected; no declaration needed.
- Use `/c` for case-sensitive evaluation (default is case-insensitive).

### Full Grammar Reference

```
Constraint    ::= IF Predicate THEN Predicate [ELSE Predicate];
               | Predicate;
Predicate     ::= Clause | Clause LogicalOp Predicate
Clause        ::= Term | (Predicate) | NOT Predicate
Term          ::= [Param] Relation Value
               | [Param] LIKE PatternString
               | [Param] IN { ValueSet }
               | [Param] Relation [Param]
```

---

## Output Parsing

PICT writes **tab-separated values** to stdout:

- Line 1: parameter names (tab-delimited)
- Lines 2+: one test case per line (tab-delimited values)

### Shell

```bash
pict model.txt > testcases.tsv
```

### Python

```python
import subprocess, csv, io

result = subprocess.run(["pict", "model.txt"], capture_output=True, text=True)
reader = csv.DictReader(io.StringIO(result.stdout), delimiter="\t")
test_cases = list(reader)
```

### Go

```go
import (
    "bytes"
    "encoding/csv"
    "os/exec"
)

out, err := exec.Command("pict", "model.txt").Output()
r := csv.NewReader(bytes.NewReader(out))
r.Comma = '\t'
records, err := r.ReadAll()
// records[0] = headers, records[1:] = test cases
```

### TypeScript / Node.js

```typescript
import { execSync } from "child_process";
import { parse } from "csv-parse/sync";

const raw = execSync("pict model.txt").toString();
const rows = parse(raw, { delimiter: "\t", columns: true });
```

---

## Integration Patterns

### Inline Model String (no temp file)

```python
import subprocess, tempfile, os, csv, io

model = """
Browser: Chrome, Firefox, Edge
OS:      Windows, macOS, Linux
Resolution: 1080p, 4K
"""

with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
    f.write(model)
    tmp = f.name

try:
    out = subprocess.run(["pict", tmp], capture_output=True, text=True).stdout
    cases = list(csv.DictReader(io.StringIO(out), delimiter="\t"))
finally:
    os.unlink(tmp)
```

### Passing CLI Options Programmatically

```python
subprocess.run(["pict", "model.txt", "/o:3", "/r:42", "/s"],
               capture_output=True, text=True)
```

### Error Handling

Always check `returncode` (non-zero = error). PICT writes diagnostics to **stderr**:

```python
result = subprocess.run(["pict", "model.txt"], capture_output=True, text=True)
if result.returncode != 0:
    raise RuntimeError(f"PICT failed:\n{result.stderr}")
```

---

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Empty output | Model file not found or wrong path | Verify path; check `result.stderr` |
| Constraint parse error | Wrong syntax or section ordering | Ensure params → sub-models → constraints |
| Invalid/ignored seed rows | Value not in model or constraint violated | Check seed values match current model |
| Non-deterministic row count | Using `/r` without fixed seed | Pin seed with `/r:<N>` for CI |
| `~` prefix in output breaks parser | Negative values passed through as-is | Strip `~` prefix in post-processing |
| FAT/FAT32 size violation | Missing constraints | Add `IF [File system] = "FAT" THEN [Size] <= 4096;` |
| Parameters in wrong order | Sub-models or constraints defined before params | Always: params first, then sub-models, then constraints |

---

## Quick Reference Card

```
# Run with default pairwise (order 2)
pict model.txt

# Triple-wise
pict model.txt /o:3

# Randomise with reproducible seed
pict model.txt /r:12345

# Include required seed rows
pict model.txt /e:seeds.txt

# Show model stats + case-sensitive
pict model.txt /s /c

# Custom separators
pict model.txt /d:; /a:^ /n:!

# Save output as TSV
pict model.txt > cases.tsv
```
