# Code review follow-ups: findings and their fixes

Status as of 2026-09-18, branch `feat/save-on-generate-dialog`: all six
findings from the 2026-09-17 review pass are fixed (TDD-first, failing test
then fix), as are the eight findings of the second review pass, the ten of the third
and the five taken from the fourth (see the sections at the end). This file stays as the record
of what was found and where each fix lives.

## Context

App.tsx was refactored (overlay precedence extracted to `src/utils/overlay.ts`,
`Header`/`StatusMessage` components extracted) and two rounds of code-review
findings around the save-on-generate dialog were fixed, all TDD-style. A final
review pass confirmed those fixes but surfaced the six findings below. A
security review of the branch found nothing.

Key places:

- `src/App.tsx` - `handleGenerateSaveConfirm` (dialog save + format
  reconciliation + busy guard), `saveResultsWith`, `requestOverlayOpen`
  (now provided by `useDeferredOverlayOpen`).
- `src/hooks/useDeferredScreenChange.ts` - queued, effect-decided screen
  changes (tab switch, overlay open) for async flows (PICT run, directory
  listing); dropped requests report back via `onDrop`.
- `src/utils/overlay.ts` - `resolveActiveOverlay`, the single overlay
  precedence table (log > docs > picker > aiSetup > aiPrompt > clearConfirm
  > generateSave).
- `src/utils/textInput.ts` - `isTextInputActive(activeTab, panel, field)`
  plus the `TEXT_INPUT_PANELS` / `TEXT_INPUT_OPTION_FIELDS` sets shared by
  the keyboard router, the model-tab hook and the deferred screen change.
- `src/utils/outputPath.ts` - `cycleFormat`, `withExtension`,
  `formatFromExtension`, shared `splitFilePath` / `extensionStart`.
- `src/utils/homePath.ts` - `expandHomePath` (`~`, `~/`, `~\` -> home dir).
- `src/hooks/useAppKeyboard.ts` - resolves the overlay once per key and
  dispatches via `switch (overlayKind)`; one `isTextInputActive` gate hands
  keys to the focused input.
- Verification: `bun run test` (147 tests; 10 POSIX-mode tests skip on
  Windows), `bun run typecheck`, `bun run check`. E2e tests live in
  `src/App.test.tsx` (note the `pressNoFlush` helper for racing keys
  against async work, and `waitFor` / `waitForConfig` for polling; the
  e2e setup fakes `HOME` and `USERPROFILE` into the per-test temp dir).

## Findings and fixes

### 1. No `~` expansion in typed output paths - FIXED

`saveTestCases` wrote the path literally, so `~/tmp/out.md` created a literal
`./~` directory in the cwd.

**Fix**: `expandHomePath` in `src/utils/homePath.ts`, applied in
`saveTestCases` (after `expandFileTemplate`) and in
`saveModelToFile` / `listModelFiles`. Cross-platform on purpose: both `~/` and
`~\` are accepted, the home directory comes from `os.homedir()` (`HOME` on
Linux, `USERPROFILE` on Windows) and the result is built with `node:path`.
`~user` and a non-leading `~` are left alone. The config keeps the typed
`~/...` form, so it stays portable; expansion happens at write time. Tests:
`homePath.test.ts`, tilde cases in `writer.test.ts` and
`modelFileService.test.ts`, and an e2e dialog save in `App.test.tsx`.

### 2. Save dialog could pop over an active text input - FIXED

**Fix**: the deferred open now also requires
`!isTextInputActive(activePanel, activeOptionField)` (panels `adding`,
`values`, `constraints`, `submodel-adding`; fields `filepath`, `order`,
`storagePath`, `fileTemplate`). The request is dropped, matching the
overlay-on-top behaviour; `[s]` still saves on demand. E2e test: generation
finishing while a parameter is being added shows no dialog.

Not changed (out of scope, worth a decision): `F2` still opens AI setup over a
tab whose text input is focused, and a successful generation still switches
to the Results tab while a model-tab input may be mid-edit.

### 3. Cycling formats destroyed dotfile-style names - FIXED

`withExtension` and `formatFromExtension` now share `extensionStart`
(`lastIndexOf(".") <= 0` means no extension), so `out/.env` + `.json` gives
`out/.env.json`. Tests in `outputPath.test.ts`.

### 4. Deferred overlay open was a single slot - FIXED

`useDeferredOverlayOpen` queues requests in an array; the effect runs the
first one when an overlay may open and clears the rest deliberately (after the
first opens, an overlay is on top - the documented drop case). Nothing is
replayed later. Hook tests in `useDeferredOverlayOpen.test.tsx` (the probe
needs `renderer.start()` before flushed state updates take effect).

### 5. Path/format helpers lived in a keyboard module - FIXED

Mechanical move to `src/utils/outputPath.ts` (tests in
`outputPath.test.ts`); imports updated in `optionsTabHandlers.ts`,
`modalHandlers.ts`, `App.tsx`.

### 6. Junk `~/` directory in the repo root - CLEARED HERE

Not present on the Windows machine where the fixes were made; the red tests
for finding 1 briefly recreated it and it was removed. If it still exists on
the original Linux machine, remove it as `rm -rf ./~` - always with the
explicit `./` prefix; an unquoted `~` would target the real home directory.
`.gitignore` keeps `/~/` so it can never be committed.

## Also fixed along the way

- `App.test.tsx` "Escape skips saving" asserted the full output path in the
  frame; on Windows the long temp path scrolls out of the dialog input, so
  it now asserts on the file name only.
- Tests that fake `HOME` / `USERPROFILE` go through `overrideEnv` in
  `src/testing/env.ts`, which leaves an originally unset variable unset on
  restore (a plain `process.env.X = undefined` stores the string
  "undefined" and leaks into later tests). Found by the 2026-09-18
  code-review pass.

## Second review pass (2026-09-18) and its fixes

A code-review pass on the fixes above returned eight findings; all fixed.

1. **Stale editing state after a generation jumped to Results** (the
   keyboard router kept swallowing keys, so the `[s]` fallback was dead).
   Two-part fix: `setActiveTab` in `App.tsx` ends any text edit on the tab
   being left (`stopEditing` in `useModelTabState`, closure-free so stale
   async callbacks still work; option field reset to `none`), and the
   generation completion itself (tab switch, status, optional dialog) is now
   one deferred `requestScreenChange`. When an overlay or a text edit is
   active at completion, nothing changes on screen and the status reads
   "Generated N test cases - see the Results tab [3], press [s] to save".
   E2e: `App.test.tsx` "finishes while a text field is being edited" checks
   the edit survives and `[s]` works after Escape.
2. **Duplicated text-input lists** in the keyboard router: replaced by one
   `isTextInputActive` gate (`src/utils/textInput.ts`), which is tab-aware.
3. **Silent drops**: every deferred request carries an `onDrop`; the picker
   reports "Model picker skipped - press [o] again".
4. **Queue vs single slot**: the array stays, because dropped requests must
   each be reported (side effects cannot run inside a state updater).
5. **Test duplication**: `settle()` on the e2e `renderApp` result;
   `overrideEnv` in `src/testing/env.ts` for `HOME` / `USERPROFILE`.
6. **`process.env.X = undefined` leaking the string "undefined"**: fixed by
   `overrideEnv`, with its own unit test.
7. **Em dashes in `CLAUDE.md`**: replaced by spaced en dashes throughout.
8. In-app help (`src/docs/pict-docs.ts`) now mentions `~` paths and the
   "nothing changes on screen" behaviour.

Deliberate behaviour change to note in the changelog: after a generation that
finishes behind an overlay, the app no longer switches to the Results tab
behind it; the status line points to `[3]` instead.

## Third review pass (2026-09-18) and its fixes

Ten findings on the second-round fixes; all fixed.

1. **F2 over a focused text input** discarded typed text: the F2 branch in
   `useAppKeyboard.ts` now also requires `!isTextInputActive(...)`. E2e:
   "F2 while a parameter name is being typed".
2. **Single-file `[o]` bypassed the deferred mechanism**: both branches of
   `handleOpenModel` go through `requestScreenChange`; a dropped load reports
   "Model load skipped - press [o] again". E2e: "single model file is loading".
3. **Stale output config in the deferred save dialog**: the apply closure
   reads `outputConfigRef.current` (latest-value ref in `App.tsx`). Tested
   deterministically by injecting a held `runPict` through the new optional
   `App` prop `runPict` (test-only seam; `index.tsx` passes nothing).
4. **`afterEach` restored XDG_CONFIG_HOME / APPDATA by assignment**: one
   `overrideEnv` call in `beforeEach` covers all four variables.
5. **Leaving the Options tab reset a highlighted non-text field**: the reset
   applies to `TEXT_INPUT_OPTION_FIELDS` only. E2e: "survives a tab round trip".
6. **`stopEditing` sent a sub-model edit to params**: maps `submodel-adding`
   to `submodels`, like Escape. Hook tests in `useModelTabState.test.tsx`.
7. **Overlay resolved twice**: `App` passes `overlayKind` into `useAppKeyboard`.
8. **Options-field cycling duplicated**: `nextOptionField` in `constants.ts`
   (unit test in `constants.test.ts`).
9. **Help** mentions `~` for the storage path too.
10. **Deferred queue kept a throwing request**: the queue is cleared before
    callbacks run.

## Fourth review pass (2026-09-18): what was fixed and what was left

Severity had dropped to polish by this pass, so five of its seven findings
were fixed and the review effort was then lowered to medium as the exit gate.

Fixed:

1. **Path and format could disagree outside the dialog** (`cases.json` with
   the TXT selector wrote TXT bytes via `[s]`): `saveTestCases` now derives
   the format from a known extension for every route. Unit tests in
   `writer.test.ts`; the unsupported-format test uses a `.dat` path so the
   extension cannot rescue the bogus format.
2. **The save-prompt toggle was frozen at `[g]` time**: the deferred
   completion reads a single `latestRef` (output config, prompt toggle,
   editing state) at apply time. E2e: "save prompt setting is read when the
   run finishes".
3. **Deferred queue could wipe a request enqueued between commit and
   effect**: the clear is a functional `slice` of the handled entries only.
4. **A throwing callback skipped the remaining drops**: try/finally drains
   the rest.
5. **Misleading "press [s]" hint while a text field is focused**: the hint
   reads "press Esc, then [3] for results or [s] to save" in that case.
   E2e updated.
7. **Dead `optionFields` prop** on the options-tab handler removed.

Left as is (cleanup only): 6. the dialog's live-input read appears twice in
`App.tsx` (the keyboard hook getter and the confirm handler).
