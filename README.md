# pairwise-tui

A terminal UI for generating [PICT](https://github.com/microsoft/pict) pairwise test cases. Define parameters, configure options, and generate combinatorial test cases — all from the terminal.

## Download & Run

Pre-built binaries for Linux and Windows are available on the [Releases page](../../releases) — no runtime required.

1. Download the binary for your platform from the latest release.
3. Run it: `./pairwise-tui.exe` on Windows or `./pairwise-tui` on Linux.

## Interface

Three tabs, navigated with `1` / `2` / `3` or `[` / `]`:

| Tab | Purpose |
|-----|---------|
| **Model** | Define parameters (name + comma-separated values) and PICT constraints |
| **Options** | Set combination order, randomize seed, case sensitivity, output file path |
| **Results** | View generated test cases in a scrollable table |

### Keyboard shortcuts

**Global:**

| Key | Action |
|-----|--------|
| `g` | Generate test cases (runs PICT) |
| `s` | Save results to output file |
| `w` | Write model to storage |
| `o` | Open model from storage (file picker) |
| `m` | Open message log overlay |
| `t` | Cycle through themes |
| `?` | Open PICT documentation |
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
| `x` | Clear entire model (prompts for confirmation) |
| `Tab` | Switch to values panel |
| `↑` / `↓` | Navigate parameters |
| `Escape` | Return to params panel / cancel edit |

**Results tab:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Scroll test cases |

**Message log overlay** (`m`):

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate log entries |
| `c` | Copy selected entry to clipboard |
| `a` | Copy all entries to clipboard |
| `m` / `Escape` | Close overlay |

**Documentation overlay** (`?`):

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate chapters / scroll content |
| `Enter` | Open selected chapter |
| `Escape` | Back / close |

## Model file format

The model is saved/loaded as a plain PICT text file (`model.txt`):

```
OS: Windows, Linux, macOS
Browser: Chrome, Firefox, Safari
Language: EN, DE, FR

IF [OS] = "Linux" THEN [Browser] <> "Safari";
```

## Development

### Requirements

- [Bun](https://bun.sh) runtime
- [Git LFS](https://git-lfs.github.com/) (for PICT binaries)

The PICT binaries (`binaries/pict` and `binaries/pict.exe`) are stored in Git LFS. You must have Git LFS installed and pull the files before running the app:

```bash
git lfs install
git lfs checkout
```

Then install dependencies and start:

```bash
bun install
bun run dev
```

### Available scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Run in watch mode |
| `bun run start` | Run the app |
| `bun run check` | Biome lint/format check |
| `bun run typecheck` | TypeScript type-check |
| `bun run build:dist` | Cross-compile to `dist/` |

## Building standalone executables

```bash
bun run build:dist
```

Outputs self-contained executables to `dist/` for Linux and Windows (no Bun required to run).

To create a new release:

```bash
git tag v1.2.3
git push --tags
```

This triggers the GitHub Actions release workflow, which builds both executables and publishes them to the Releases page automatically.
