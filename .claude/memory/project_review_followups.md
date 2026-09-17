---
name: project-review-followups
description: Open code-review findings on feat/save-on-generate-dialog have a fix plan in docs/plans/code-review-followups.md
metadata:
  type: project
---

On 2026-09-17 the App.tsx refactor (overlay precedence -> `src/utils/overlay.ts`, Header/StatusMessage extraction) plus two rounds of review fixes were committed and pushed on branch `feat/save-on-generate-dialog` (commit ff8e3e5). A final review pass left SIX findings unfixed; they are fully documented with planned fixes, priorities and file pointers in `docs/plans/code-review-followups.md` (in the repo) - read that file first when resuming.

Highest priority there: (1) no `~` expansion in typed output paths (writes a literal `./~` dir; a junk `./~/` directory from this may still sit untracked in the repo root on the original machine - delete as `rm -rf ./~`, never unquoted `~`; `.gitignore` has `/~/`), and (2) the save dialog's deferred open can still pop over an active text input and discard typed text.

Security review of the branch was clean. Suite state at commit: 114 tests, typecheck and Biome clean. See [[tdd-review-workflow]] for how the user wants this work done.
