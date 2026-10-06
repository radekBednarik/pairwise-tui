---
name: project-release-process
description: How to cut a pairwise-tui release - version bump in scripts/build-windows.ts, then tag; a bare tag push is not enough
metadata:
  type: project
---

A release is not just a tag push. Steps:
1. On `main`, bump `version` in `scripts/build-windows.ts` (the Windows exe metadata; `package.json` has no version field) and commit as `chore: Bump version to X.Y.Z`.
2. Push `main`, then create a lightweight tag `vX.Y.Z` on that bump commit and push it.
3. `.github/workflows/release.yml` (on tag `v*.*.*`) builds Linux/Windows binaries + AppImage and creates the GitHub release with generated notes.

Branch CI: the only PR check is GitHub's CodeQL default setup, so open a PR to get checks before merging.

**Why:** the user pointed out that pushing a tag alone does not make a proper release; previous releases (v1.5.0, v1.5.1) all used a bump commit followed by the tag.
**How to apply:** whenever asked to "do the release", bump version first, then tag. Patch bump for small tweaks, minor for features, unless the user says otherwise.
