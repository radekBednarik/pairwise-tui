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
| **Options** | Set combination order, randomize seed, case sensitivity, output file path, output format, storage path, file template, AI model |
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
| `i` | Open AI prompt overlay (or AI setup if no API key configured) |
| `F2` | Open AI setup overlay |
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

**AI setup overlay** (`F2` or `i` without key):

| Key | Action |
|-----|--------|
| `Enter` | Save API key |
| `d` | Clear saved API key |
| `Escape` | Close overlay |

**AI prompt overlay** (`i`):

| Key | Action |
|-----|--------|
| `Ctrl+G` | Generate parameters from description |
| `F2` | Switch to AI setup |
| `Escape` | Cancel |

**Documentation overlay** (`?`):

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate chapters / scroll content |
| `Enter` | Open selected chapter |
| `Escape` | Back / close |

## AI Parameter Generation

Pairwise-TUI can generate PICT parameters automatically from a natural language description using Claude.

### Setup

1. Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com).
2. Press `F2` (or press `i` when no key is configured) to open the AI Setup overlay.
3. Type your API key and press `Enter` to save it. Press `d` to clear a saved key.

The key is stored at:
- Linux/macOS: `~/.config/pairwise-tui/credentials.json` (chmod 600)
- Windows: `%APPDATA%\pairwise-tui\credentials.json`

The `ANTHROPIC_API_KEY` environment variable takes precedence over the stored key.

### Usage

1. Press `i` to open the AI prompt overlay.
2. Describe the feature or test scenario in plain text, e.g. `Login form with email, password, and remember-me checkbox`.
3. Press `Ctrl+G` to generate parameters.
4. Review the generated parameters in the Model tab.
5. Press `g` to run PICT and generate test cases.

### Model selection

In the **Options** tab, tab to the **AI Model** field and press `Enter` to cycle through models:

| Model | Characteristics |
|-------|----------------|
| `claude-haiku-4-5` | Fastest, lowest cost (default) |
| `claude-sonnet-4-6` | Balanced speed and capability |
| `claude-opus-4-6` | Most capable, highest cost |

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
| `bun run build:dist` | Build Linux and Windows executables to `dist/` |
| `bun run build:dist:linux` | Build the Linux executable |
| `bun run build:dist:windows` | Build the Windows executable |
| `bun run package:appimage` | Package the Linux AppImage |

## Building standalone executables

```bash
bun run build:dist
```

Outputs self-contained executables to `dist/` for Linux and Windows (no Bun required to run).

Windows builds must run on Windows for the custom executable icon to be embedded.

To package the Linux AppImage after building the Linux executable:

```bash
bun run build:dist:linux
APPIMAGETOOL=./dist/appimagetool.AppImage bun run package:appimage
```

The release workflow publishes three artifacts:

- `pairwise-tui.exe` for Windows with the custom app icon
- `pairwise-tui` as the raw Linux executable
- `Pairwise-TUI-x86_64.AppImage` as the desktop-friendly Linux download

To create a new release:

```bash
git tag v1.2.3
git push --tags
```

This triggers the GitHub Actions release workflow, which builds the Windows executable, Linux executable, and Linux AppImage, then publishes them to the Releases page automatically.
