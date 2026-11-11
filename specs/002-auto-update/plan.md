# Implementation Plan: Automatic Application Update

**Branch**: `002-auto-update` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-auto-update/spec.md`

## Summary

The app checks this project's GitHub releases at startup (at most once per 24 h, in the background) and, when a higher stable version with an artifact for the running install kind exists, offers it in an overlay: Update now, Update on exit, Not now, Skip this version. Nothing is downloaded before the user agrees. The artifact is streamed beside the app, verified against a `SHA256SUMS.txt` published with the release, and swapped in inside the same directory: one atomic rename-over on Linux and AppImage, two renames on Windows, keeping a single backup of the old file (research R5, R6). Linux and AppImage restart through `process.execve`, Windows through a waited child process (R8). A verified update that was not installed at exit is installed at the next startup before the interface is created (R10). The release workflow gains checksums and a tag/version guard, and `package.json` becomes the single version source (R1).

## Technical Context

**Language/Version**: TypeScript (strict), run and compiled with Bun 1.4.x

**Primary Dependencies**: React + `@opentui/react` / `@opentui/core` 0.5.x. **No new dependencies**: `fetch`, `Bun.CryptoHasher`, `node:fs/promises` and `process.execve` cover everything

**Storage**: `config.json` (new `autoUpdate` key) and a new `update.json` in the app config directory; staging files beside the app file ([data-model.md](./data-model.md))

**Testing**: `bun test`, colocated `*.test.ts(x)`. Updater modules take `fetch`, clock, paths and platform as parameters; file swaps run in temp dirs; a local `Bun.serve` acts as release source; UI through `renderTest`

**Target Platform**: Linux x64 (plain executable and AppImage) and Windows x64 terminals

**Project Type**: Single-project TUI application

**Performance Goals**: Startup unaffected (check runs after first render, never awaited by the UI). Download streamed with flat memory for a roughly 100 MB artifact

**Constraints**: App must stay startable after any failure (FR-027). No elevation. No network contact when the setting is off. Works on Linux and Windows. No change to existing behaviour outside the spec. No em dashes in new text (org rule). Biome and tsc clean

**Scale/Scope**: About 9 new source modules with tests, 1 new overlay, edits to about 10 existing files, 3 build/release files, README and in-app docs

**Open risk**: Windows restart with an inherited console is unverified on this machine (R8); a fallback allowed by the spec is defined, and quickstart V8 decides.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template, so it defines no gates. The project's conventions (CLAUDE.md, `.claude/memory/`) apply instead:

| Gate | Status |
|------|--------|
| Tests first: failing tests before source changes | PASS, planned. Every updater module is designed for injection so it can be tested first (R14) |
| `bun run check` + `bun run typecheck` + `bun run test` green before commit | PASS, planned (quickstart section 1) |
| No change to existing behaviour outside scope | PASS. Existing settings, shortcuts and overlays keep their behaviour; the only touched shared paths are the quit action and the overlay precedence list, both additive |
| Works on Linux AND Windows | PASS by design (R6, R8), with one unverified point tracked as open risk |
| OpenTUI rules: no `process.exit()` while the renderer lives, read input values from refs | PASS. Quit and restart go through `renderer.destroy()` first; the overlay has no text input |
| Code and security review after implementation | PASS, planned. This feature downloads and executes code, so the review must cover: fixed download origin, checksum enforcement and re-check before install, staging file handling, AppImage target guard, sanitizing of remote text shown in the terminal, and absence of any shell invocation |

Post-design re-check: still PASS. No violation to justify; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-auto-update/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── update-interface.md
│   └── release-and-storage.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks (not yet created)
```

### Source Code (repository root)

```text
package.json                         # + "version" (single source, R1)
scripts/
├── build-linux.ts                   # + define __RELEASE_BUILD__
├── build-windows.ts                 # + define, version read from package.json
└── dev-fake-release.ts              # new: local release source for manual validation
.github/workflows/release.yml        # + tag/version guard, + SHA256SUMS.txt asset
README.md                            # update behaviour, opt-out, restore steps
.claude/memory/project_release_process.md   # bump location changes

src/
├── index.tsx                        # startup step before the renderer (R10)
├── App.tsx                          # wire useUpdateState, single quit(), unsaved-work check
├── constants.ts                     # OPTION_FIELDS + autoUpdate, checkUpdates
├── settings/store.ts                # + autoUpdate
├── utils/overlay.ts                 # + "update" kind (lowest precedence)
├── update/                          # new, no React in here
│   ├── globals.d.ts                 # build-time constants (__RELEASE_BUILD__, __UPDATE_SOURCE_OVERRIDE__)
│   ├── version.ts                   # installed version, parse, compare
│   ├── platform.ts                  # InstallContext: kind, target, writability, identity
│   ├── release.ts                   # check request, response validation, notes sanitizing
│   ├── download.ts                  # checksum file, streamed download, hash, progress, abort
│   ├── install.ts                   # lock, swap, chmod, backup, cleanup
│   ├── restart.ts                   # execve / waited child / fallback message
│   ├── state.ts                     # update.json load, validate, save
│   └── startup.ts                   # cleanup + finish pending install before UI
├── hooks/
│   ├── useUpdateState.ts            # flow state machine (data-model section 7)
│   ├── useUnsavedWork.ts            # optional: unsaved-work check, if extracted from App.tsx (R12)
│   └── keyboard/
│       ├── modalHandlers.ts         # + handleUpdateKeys
│       └── optionsTabHandlers.ts    # + autoUpdate toggle, checkUpdates action
├── components/
│   ├── UpdateOverlay.tsx            # phases offer, notice, unsavedWarning, downloading, error
│   └── OptionsTab.tsx               # + Updates section
└── docs/pict-docs.ts                # in-app docs: Updates section
```

Tests are colocated: `src/update/*.test.ts`, `src/hooks/useUpdateState.test.tsx`, additions to `modalHandlers.test.ts`, `optionsTabHandlers.test.ts`, `settings/store.test.ts`, `utils/overlay.test.ts`, `App.test.tsx`.

**Structure Decision**: Single project, as today. All update logic sits in a new `src/update/` directory with no UI imports, mirroring how `src/pict/` and `src/ai/` are separated from components. React only touches it through one hook, `useUpdateState`, which follows the existing `useModalState` / `useAiState` pattern.

## Design Notes

Order of work implied by dependencies (for `/speckit-tasks`):

1. **Foundation**: version source and release flag (R1, R2), `autoUpdate` setting, `update.json` store, `platform.ts`. Nothing user-visible yet except the version row.
2. **Check and offer** (US1 part, US3, US4, US6): `release.ts`, throttling, overlay phases `offer` and `notice`, Options section, manual check, skip.
3. **Download, verify, install, restart** (US1, US7): `download.ts`, `install.ts`, `restart.ts`, phases `downloading` and `error`. Windows restart spike first (open risk).
4. **On exit and next startup** (US2): single `quit()`, `startup.ts`.
5. **Unsaved work** (US5): dirty check and phase `unsavedWarning`.
6. **Release side and docs**: `release.yml`, README, in-app docs, memory file, fake release script.
7. **Review**: code review and security review passes, then manual quickstart scenarios on Linux, AppImage and Windows.

The first release containing this feature cannot update *to* itself from older versions (they have no updater); the first real end-to-end proof in production is the release after it.

## Complexity Tracking

No violations.
