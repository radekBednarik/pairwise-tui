# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime

Default to Bun instead of Node.js: `bun <file>`, `bun test`, `bun install`, `bun run <script>`, `bunx`.
Prefer `Bun.file` over `node:fs`. Use `Bun.$\`cmd\`` instead of execa. Bun auto-loads `.env`.

## Commands

- `bun run dev` — run in watch mode (src/index.tsx)
- `bun run start` — run the TUI app
- `bun run build:dist` — cross-compile to dist/ (Linux + Windows executables)
- `bun run check` — Biome lint/format check
- `bun run typecheck` — TypeScript type-check (tsc --noEmit)

## Architecture

Pairwise-TUI is a terminal app for generating PICT pairwise test cases. It uses React + OpenTUI (`@opentui/react`) for rendering.

**Entry point**: `src/index.tsx` → mounts React root using OpenTUI

**Main component**: `src/App.tsx` — centralized state, keyboard handling, tab routing

**Three tabs**:
- `ModelTab` — define parameters and PICT constraints
- `OptionsTab` — PICT options (combination order, randomize, case sensitivity)
- `ResultsTab` — view generated test cases

**Utilities**:
- `src/pict/model.ts` — serialize/deserialize PictModel ↔ PICT text format
- `src/pict/runner.ts` — execute PICT binary, parse TSV output into TestCase[]
- `src/output/writer.ts` — write test cases to TSV file
- `src/types.ts` — shared TypeScript interfaces (Parameter, PictModel, PictOptions, TestCase)

**PICT binaries**: `binaries/pict` (Linux) and `binaries/pict.exe` (Windows) — embedded as Bun assets, extracted to /tmp at runtime.

## Key Conventions

- Linting: Biome (tabs, strict rules) — run `bun run check` before committing
- Keyboard-driven UI: global shortcuts (`q` quit, `g` generate, `s` save, `o` open, `w` write model), tab navigation via `1/2/3` or `[/]`
- No tests currently exist in this repo
