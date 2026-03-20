# pairwise-tui

A terminal UI for generating [PICT](https://github.com/microsoft/pict) pairwise test cases. Define parameters, configure options, and generate combinatorial test cases — all from the terminal.

## Requirements

- [Bun](https://bun.sh) runtime
- Linux or Windows (PICT binaries for both are embedded)

## Usage

```bash
bun install
bun run start
```

For development with auto-reload:

```bash
bun run dev
```

## Interface

Three tabs, navigated with `1` / `2` / `3` or `[` / `]`:

| Tab | Purpose |
|-----|---------|
| **Model** | Define parameters (name + comma-separated values) and PICT constraints |
| **Options** | Set combination order, randomize seed, case sensitivity, output file path |
| **Results** | View generated test cases in a scrollable table |

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `g` | Generate test cases (runs PICT) |
| `s` | Save results to output file |
| `w` | Write model to `model.txt` |
| `o` | Open model from `model.txt` |
| `q` / `Ctrl+C` | Quit |
| `1` / `2` / `3` | Switch tabs |
| `[` / `]` | Previous / next tab |

**Model tab — params panel:**

| Key | Action |
|-----|--------|
| `a` | Add parameter |
| `d` | Delete selected parameter |
| `e` | Edit values for selected parameter |
| `c` | Edit constraints |
| `Tab` | Switch between params and values panels |
| `Escape` | Return to params panel |

## Model file format

The model is saved/loaded as a plain PICT text file (`model.txt`):

```
OS: Windows, Linux, macOS
Browser: Chrome, Firefox, Safari
Language: EN, DE, FR

IF [OS] = "Linux" THEN [Browser] <> "Safari";
```

## Building standalone executables

```bash
bun run build:dist
```

Outputs self-contained executables to `dist/` for Linux and Windows (no Bun required to run).

## Releases

Pre-built binaries for Linux and Windows are available on the [Releases page](../../releases).

To create a new release:

```bash
git tag v1.2.3
git push --tags
```

This triggers the GitHub Actions release workflow, which builds both executables and publishes them to the Releases page automatically.
