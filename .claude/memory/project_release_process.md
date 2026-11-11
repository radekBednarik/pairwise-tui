---
name: project-release-process
description: How to cut a pairwise-tui release - bump version in package.json, commit to main, then push a matching vX.Y.Z tag (the tag push starts the release workflow, which refuses a mismatch)
metadata:
  type: project
---

A release is not just a tag push. Steps:
1. On `main`, bump `version` in `package.json` and commit as `chore: Bump version to X.Y.Z`. `package.json` is the single version source since the auto-update feature (specs/002-auto-update): the app imports it (`src/update/version.ts`), `scripts/build-windows.ts` reads it for the exe metadata, and installed copies compare it with release tags.
2. Push `main`, then create a lightweight tag `vX.Y.Z` on that bump commit and push it. The tag must equal `v` + the `package.json` version: the `guard` job in `release.yml` fails the run otherwise, before anything is built.
3. `.github/workflows/release.yml` (on tag `v*.*.*`) builds Linux/Windows binaries + AppImage and creates the GitHub release with generated notes, plus `SHA256SUMS.txt`.

Do not rename release assets (`pairwise-tui`, `pairwise-tui.exe`, `Pairwise-TUI-x86_64.AppImage`, `SHA256SUMS.txt`): installed copies find and verify their update by these exact names, so a rename cuts them off from updates.

Never set `UPDATE_SOURCE_OVERRIDE` for a build that gets published; it bakes a local update source into the executables (manual test rig only, see `scripts/dev-fake-release.ts`). The workflow refuses to run with it set.

Branch CI: the only PR check is GitHub's CodeQL default setup, so open a PR to get checks before merging.

**Why:** previous releases (v1.5.0-v1.7.0) all used a bump commit followed by the tag; until 1.7.0 the bump was in `scripts/build-windows.ts`. The tag push starts the workflow (confirmed by the user on 2026-10-06); release.yml has no `workflow_dispatch`, so it cannot be started manually. Verify with `gh run list -w Release` and `gh release view vX.Y.Z`.
**How to apply:** whenever asked to "do the release", bump `package.json` first, then tag. Patch bump for small tweaks, minor for features, unless the user says otherwise.
