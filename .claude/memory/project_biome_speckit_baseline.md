---
name: biome-speckit-baseline
description: bun run check fails on 6 speckit-generated .specify/*.json files since the speckit commit (5793138); not a regression, compare against that baseline
metadata:
  type: project
---

Since `chore: Add speckit` (5793138, 2026-11), `bun run check` (`biome check .`) reports 6 format errors, all in speckit's own JSON files: `.specify/init-options.json`, `.specify/integration.json`, `.specify/integrations/{claude,speckit}.manifest.json`, `.specify/memory/.constitution-template.json`, `.specify/workflows/workflow-registry.json`. They use 2-space indents, and Biome here wants tabs.

**Why:** these files are written by the speckit tool, so reformatting them by hand may be overwritten or may confuse the tool. On 2026-11-10 the user hadn't decided whether to exclude `.specify/` in biome.json or reformat.
**How to apply:** treat "Found 6 errors", all under `.specify/`, as the baseline. To confirm touched code is clean, run `bunx biome check src README.md docs`. Don't fix them unasked; ask whether to add `.specify` to Biome's ignore list. Related: [[tdd-review-workflow]].
