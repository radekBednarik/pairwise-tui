# Code review follow-ups: open findings and planned fixes

Status as of 2026-09-17, branch `feat/save-on-generate-dialog`.

## Context

App.tsx was refactored (overlay precedence extracted to `src/utils/overlay.ts`,
`Header`/`StatusMessage` components extracted) and two rounds of code-review
findings around the save-on-generate dialog were fixed, all TDD-style. A final
review pass confirmed those fixes but surfaced the six findings below, which
are NOT yet fixed. A security review of the branch found nothing.

Key places:

- `src/App.tsx` - `handleGenerateSaveConfirm` (dialog save + format
  reconciliation + busy guard), `saveResultsWith`, `requestOverlayOpen` +
  the deferred-open effect (search for `deferredOverlayOpen`).
- `src/utils/overlay.ts` - `resolveActiveOverlay`, the single overlay
  precedence table (log > docs > picker > aiSetup > aiPrompt > clearConfirm
  > generateSave). Render, StatusBar and keyboard routing all derive from it.
- `src/hooks/useAppKeyboard.ts` - resolves the overlay once per key and
  dispatches via `switch (overlayKind)`.
- `src/hooks/keyboard/optionsTabHandlers.ts` - `cycleFormat`,
  `withExtension`, `formatFromExtension`, shared `splitFilePath`.
- Verification: `bun run test` (114 tests), `bun run typecheck`,
  `bun run check`. E2e tests live in `src/App.test.tsx` (note the
  `pressNoFlush` helper for racing keys against async work, and `waitFor`
  / `waitForConfig` for polling).

## Open findings

### 1. No `~` expansion in typed output paths (high priority)

`saveTestCases` (`src/output/writer.ts`) writes the path literally, so typing
`~/tmp/out.md` in the save dialog creates a literal `./~` directory in the
cwd, and the config write-back persists that broken path as the default.
On-disk evidence: the untracked `~/` directory in the repo root was created
this way during manual testing (see finding 6).

**Fix**: add `expandHomePath(path)` to `src/utils/` (leading `~/` or bare `~`
-> `os.homedir()`), apply it in `saveTestCases` next to `expandFileTemplate`,
and in `src/services/modelFileService.ts` (`saveModelToFile`,
`listModelFiles`) so model storage paths behave the same. Unit-test the
helper; e2e-test a `~/`-prefixed save via a faked `HOME`.

### 2. Save dialog can pop over an active text input (high priority)

The deferred-open effect in `src/App.tsx` only refuses to open when another
*overlay* is up. If generation finishes while the user is typing (add-param
input, values, constraints, options text field), the dialog replaces the tab
content, unmounts the focused input and discards the typed text - the exact
failure the F2 guard in `useAppKeyboard.ts` defends against.

**Fix**: extend the effect's condition: only open when no text-editing mode is
active - `modelTab.activePanel` not in `adding` / `values` / `constraints` /
`submodel-adding` and `activeOptionField` is not one of the text fields
(`filepath`, `order`, `storagePath`, `fileTemplate`). Consider extracting an
`isTextInputActive(activePanel, activeOptionField)` helper next to
`resolveActiveOverlay` so F2 can share it. Decide whether to drop the request
(matches current overlay behaviour) or defer until typing ends - dropping is
simpler and `[s]` still saves on demand.

### 3. Cycling formats destroys dotfile-style names

`withExtension("out/.env", ".json")` returns `out/output.json`: its
`/\.[^.]+$/` strip disagrees with `formatFromExtension`, which treats a
leading-dot name as having no extension.

**Fix**: in `withExtension`, compute the dot via
`name.lastIndexOf(".")` and treat `dot <= 0` as "no extension" (keep the
whole name as base), mirroring `formatFromExtension`. Add unit tests for
`.env` / `.json` names in `src/hooks/keyboard/optionsTabHandlers.test.ts`.

### 4. Deferred overlay open is a single slot

`requestOverlayOpen` stores one callback; two requests landing before the
effect runs (e.g. `[o]` listing and a `[g]` generation resolving in the same
React batch) silently drop the first.

**Fix**: make the pending state an array (`setDeferred((q) => [...q, open])`),
have the effect run the first openable request and keep/drop the rest
deliberately - or keep the slot but `showStatus` when overwriting a pending
request. Rare in practice; choose the simplest option that is not silent.

### 5. Path/format helpers live in a keyboard module

`cycleFormat`, `withExtension`, `formatFromExtension`, `splitFilePath` are
pure string utilities in `src/hooks/keyboard/optionsTabHandlers.ts`, now
imported by `App.tsx` and `modalHandlers.ts`.

**Fix**: mechanical move to `src/utils/outputPath.ts` (tests move alongside as
`outputPath.test.ts`), update imports in `optionsTabHandlers.ts`,
`modalHandlers.ts`, `App.tsx`. No behaviour change.

### 6. Junk `~/` directory in the repo root

Created by finding 1 during manual testing; contains generated
`model_*.txt` / `generated-tests_*.md` output. `.gitignore` now contains
`/~/` so it cannot be committed accidentally, but it should be deleted once
its contents are confirmed disposable. Remove it as `rm -rf ./~` - always
with the explicit `./` prefix; an unquoted `~` would target the real home
directory.

## Suggested order

1 and 2 first (real data-loss/user-facing bugs), then 3, then 4, then the
mechanical 5, then delete 6. Keep the TDD flow: failing test first, fix,
`bun run test && bun run typecheck && bun run check`, and finish with a
code-review pass.
