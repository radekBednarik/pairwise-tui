---
name: project-review-followups
description: The 2026-09-17 review findings on feat/save-on-generate-dialog plus the follow-up review's eight findings were fixed on 2026-09-18; record and pointers in docs/plans/code-review-followups.md
metadata:
  type: project
---

On 2026-09-18 all six open code-review findings on branch `feat/save-on-generate-dialog` were fixed TDD-first, then a second review pass found eight more (stale editing state after generation, duplicated text-input lists, silent drops, env-restore bug in tests, em dashes in CLAUDE.md, test duplication) and a third found ten (F2 over a text input, single-file [o] bypassing the deferral, stale output config in the deferred dialog, and smaller consistency items); a fourth found seven polish items of which five were fixed (save-time format reconciliation in `saveTestCases`, `latestRef` for the deferred completion, queue hardening, Esc hint). Review effort was then lowered to medium as the exit gate because high-effort passes kept producing polish. `App` has an optional `runPict` prop purely as a test seam for holding a run open. `docs/plans/code-review-followups.md` records every finding and where its fix and tests live - read it first when resuming.

Key design now: a finished generation or directory listing goes through `requestScreenChange` (`src/hooks/useDeferredScreenChange.ts`); when an overlay is open or a text field is being edited, nothing changes on screen and the status line says "... see the Results tab [3], press [s] to save" / "Model picker skipped - press [o] again". Behaviour change worth a changelog line: the app no longer switches to Results behind an open overlay. `isTextInputActive(activeTab, panel, field)` in `src/utils/textInput.ts` is the single gate for "keys go to an input".

The user requires the app to work on Linux AND Windows: path handling must accept both separators, use `os.homedir()` / `node:path`, and tests must not assume POSIX temp paths (Windows temp paths are long and scroll out of narrow inputs). Tests that fake env vars use `overrideEnv` from `src/testing/env.ts`. The junk `./~` dir from the tilde bug may still exist on the original Linux machine - delete as `rm -rf ./~`, never unquoted `~`.

Suite state after the fixes: 147 tests (10 POSIX-only skips on Windows), typecheck and Biome clean; nothing committed yet at the time of writing. See [[tdd-review-workflow]] for how the user wants this work done.
