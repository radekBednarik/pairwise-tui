---

description: "Task list for Fable 5.2 AI model support and the Anthropic SDK 1.x upgrade"
---

# Tasks: Fable 5.2 AI Model Support

**Input**: Design documents from `/specs/001-fable-5-2-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-model-selection.md, quickstart.md

**Tests**: Included. The project works test-first (project memory: write the failing tests, then the code, then a code and security review), and FR-012 requires the tests to be updated.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)

## Conventions for every task

- Run commands from the repo root with Bun (`bun run test`, `bun run check`, `bun run typecheck`).
- Biome style: tabs, double quotes.
- **Never write an em dash** in new or edited text (org rule). Where an existing line already uses one as a column separator (in-app help), change only the version token.
- Don't change behaviour outside the spec. The default stays `claude-sonnet-5-5`, the existing retired-model carry-overs stay, and the request body stays the same apart from `model`.

---

## Phase 1: Setup

**Purpose**: Get a clean, isolated starting point.

- [X] T001 Create and switch to branch `001-fable-5-2-support` from an up-to-date `main` (`git switch -c 001-fable-5-2-support`). Confirm `git status` is clean apart from `specs/001-fable-5-2-support/` and `.specify/feature.json`
- [X] T002 Record the baseline: run `bun run typecheck && bun run check && bun run test` and note the pass/fail counts, so later regressions can be told apart from failures that were already there

---

## Phase 2: Foundational (blocking, the SDK upgrade)

**Purpose**: Upgrade `@anthropic-ai/sdk` 0.129.0 → 1.7.0 (FR-011, SC-005, research R2) *before* any model change. SDK breakage then stays separate from the model swap, and every story is built and tested on the final SDK.

**⚠️ CRITICAL**: No user-story work starts until T007 is green.

- [X] T003 Write the offline wire test first (red on 0.129): in src/ai/client.test.ts add `test("the default client sends the 2026-10-21 API version and a bearer key", …)`. Save `globalThis.fetch`, replace it with a stub that records the `Request` (or the `(url, init)` pair) and returns `new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "stub" } }), { status: 401, headers: { "content-type": "application/json" } })`, then call `generateModel("login form", "test-key")` **without** a client argument, so the real `new Anthropic({ apiKey })` default path runs. Expect it to reject, and restore `globalThis.fetch` in a `finally`/`afterEach`. Assert on the one captured request: URL ends with `/v1/messages`; header `anthropic-version` is `"2026-10-21"`; header `authorization` is `"Bearer test-key"`; header `x-api-key` is absent; JSON body has `model` `"claude-sonnet-5-5"` (the default; US1 doesn't exist yet), `max_tokens` 64000, `stream` true, `output_config.effort` `"high"`, and no `thinking`, `temperature`, `top_p` or `top_k` keys. 401 is not retried by the SDK, so exactly one request is expected. Never use a real key or reach the network. Run `bun test src/ai/client.test.ts` and confirm this test fails on 0.129 (it sends `x-api-key` and `2023-06-01`). That red result is what the upgrade has to turn green. If the stub isn't called because the SDK caught `fetch` before the swap, use `spyOn(globalThis, "fetch")` from `bun:test` instead
- [X] T004 Upgrade the SDK in package.json and bun.lock: run `bun add @anthropic-ai/sdk@^1.7.0`. Confirm package.json now reads `"@anthropic-ai/sdk": "^1.7.0"` (caret pin style kept) and that `bun pm ls | grep @anthropic-ai/sdk` shows exactly one 1.x copy. Don't add `zod`; it stays an optional peer
- [X] T005 Run `bun run typecheck`. If it fails, fix only errors caused by the SDK's 1.x type changes, within the list in research.md R2 "Change 5". The likely places are the `AiClient` interface in src/ai/client.ts (`Anthropic.MessageStreamParams`, `Anthropic.Message`) and the response fixtures in src/ai/client.test.ts (`text()` helper, `Anthropic.ContentBlock[]` casts). Keep the request content (model, system prompt, message text, `max_tokens`, `output_config`) exactly as it is. Don't add `baseURL`, `defaultHeaders`, `anthropic-version` overrides or extra credentials
- [X] T006 Re-run the upgrade searches and confirm no hits: `grep -rnE -i "temperature|top_p|topP|top_k|topK|extra_body|x-api-key|anthropic[-_]version|compactionControl|completions" src`. Also confirm `new Anthropic({ apiKey })` in src/ai/client.ts still passes exactly one credential (1.x throws `TypeError` for two)
- [X] T007 Run `bun run typecheck && bun run check && bun run test`. The results must match the T002 baseline, plus the T003 wire test now passing (red before T004, green after). Commit the test with the bump as `chore(deps): Bump @anthropic-ai/sdk to 1.7.0` with a body noting the API version moves to 2026-10-21, the key is sent as `Authorization: Bearer`, and the SDK license is now Apache 2.0

**Checkpoint**: The app runs on SDK 1.x with Fable 5.1 still offered, and everything is green.

---

## Phase 3: User Story 1 - Generate a model with Fable 5.2 (Priority: P1) 🎯 MVP

**Goal**: The Options tab offers Haiku 5.5 → Sonnet 5.5 → Opus 5.5 → Fable 5.2 (no Fable 5.1), and a generation with Fable 5.2 sends `model: "claude-fable-5-2"` (contracts C1, C2, C4).

**Independent Test**: `bun test src/hooks/keyboard/optionsTabHandlers.test.ts src/ai/client.test.ts src/constants.test.ts` passes. In `bun run start`, cycling the AI Model field shows the four labels and the AI prompt overlay names "Fable 5.2".

### Tests for User Story 1 (write first, see them fail) ⚠️

- [X] T008 [P] [US1] In src/hooks/keyboard/optionsTabHandlers.test.ts, test "Enter on the ai model field cycles through the models and wraps" (around line 110): change the expected `"claude-fable-5-1"` to `"claude-fable-5-2"`, keeping the full cycle sonnet-5-5 → opus-5-5 → fable-5-2 → haiku-5-5 → sonnet-5-5
- [X] T009 [P] [US1] In src/ai/client.test.ts, test "streams the request with room for thinking and a JSON schema format" (around line 38): pass `"claude-fable-5-2"` to `generateModel` and expect `params?.model` to be `"claude-fable-5-2"`. Keep the `max_tokens` 64000, `effort` "high" and `json_schema` assertions unchanged, and keep asserting that no `thinking` field is sent if the test already does
- [X] T010 [P] [US1] Create src/constants.test.ts with tests that: `AI_MODELS` equals exactly `["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-2"]`; `AI_MODELS` does not contain `"claude-fable-5-1"`; `AI_MODEL_LABELS["claude-fable-5-2"]` is `"Fable 5.2"`; every entry of `AI_MODELS` has a label in `AI_MODEL_LABELS` (import from ../types); and `DEFAULT_AI_MODEL` is `"claude-sonnet-5-5"` (FR-005)
- [X] T011 [US1] Run `bun test src/hooks/keyboard/optionsTabHandlers.test.ts src/ai/client.test.ts src/constants.test.ts` and `bun run typecheck`. Confirm T008 and T010 fail at runtime and T009 fails the type check (`"claude-fable-5-2"` is not yet an `AiModel`)

### Implementation for User Story 1

- [X] T012 [US1] In src/types.ts, replace the `AiModel` union member `"claude-fable-5-1"` with `"claude-fable-5-2"`, and replace the `AI_MODEL_LABELS` entry `"claude-fable-5-1": "Fable 5.1"` with `"claude-fable-5-2": "Fable 5.2"`. Leave the other three members and labels unchanged
- [X] T013 [US1] In src/constants.ts, replace `"claude-fable-5-1"` with `"claude-fable-5-2"` in `AI_MODELS`, keeping it last (after `"claude-opus-5-5"`). `DEFAULT_AI_MODEL` stays `"claude-sonnet-5-5"`
- [X] T014 [US1] Run `bun test src/hooks/keyboard/optionsTabHandlers.test.ts src/ai/client.test.ts src/constants.test.ts && bun run typecheck` and confirm both are green. tsc must be clean: `RETIRED_AI_MODELS` in src/settings/store.ts has no Fable entry yet (US2 adds it), so nothing there refers to the removed `claude-fable-5-1` member

**Checkpoint**: Fable 5.2 is selectable and is sent to the API. This is a working MVP.

---

## Phase 4: User Story 2 - Saved Fable 5.1 choice carries over (Priority: P2)

**Goal**: Saved `aiModel: "claude-fable-5-1"` loads as `claude-fable-5-2`, and the existing carry-overs and unknown-value fallback are unchanged (contract C3, FR-004, data-model `RETIRED_AI_MODELS`).

**Independent Test**: `bun test src/settings/store.test.ts` passes, including the new Fable case and the three existing retired-model cases.

### Tests for User Story 2 (write first, see them fail) ⚠️

- [X] T015 [US2] In src/settings/store.test.ts, next to the existing "a saved retired … model is upgraded to its successor" tests (around line 69), add `test("a saved retired fable model is upgraded to its successor", …)`: write `{ aiModel: "claude-fable-5-1" }` with the existing `writeConfig` helper and expect `(await loadSettings()).aiModel` to be `"claude-fable-5-2"`. Also add a test where a saved `"claude-fable-5-2"` loads unchanged. Also add a **required** round-trip test (spec US2 scenario 4, contract C3 "Written on next save"): write `{ aiModel: "claude-fable-5-1" }`, `const s = await loadSettings()`, `await saveSettings(s)` (`saveSettings` is already imported, see line ~56), then `loadSettings()` again and expect `aiModel` to be `"claude-fable-5-2"`. If this file has a helper that reads the raw config, also assert the raw JSON's `aiModel` is `"claude-fable-5-2"`
- [X] T016 [US2] Run `bun test src/settings/store.test.ts` and confirm the new carry-over test fails (today it falls back to `"claude-sonnet-5-5"`)

### Implementation for User Story 2

- [X] T017 [US2] In src/settings/store.ts `RETIRED_AI_MODELS` (around line 86), add the entry `"claude-fable-5-1": "claude-fable-5-2",` after the haiku entry. Don't change `asAiModel`. Its order (retired map first, then `AI_MODELS` membership, then the fallback) is what the data model requires
- [X] T018 [US2] Run `bun test src/settings/store.test.ts` and confirm all retired-model tests (opus, sonnet, haiku, fable) and the unknown-value fallback test pass

**Checkpoint**: Upgrading users keep their top-model choice.

---

## Phase 5: User Story 3 - Documentation names the current models (Priority: P3)

**Goal**: Every user-facing and maintainer-facing mention names Fable 5.2 (FR-006 to FR-010, contract C5, research R4).

**Independent Test**: `grep -rln "fable-5-1\|Fable 5.1" src README.md docs` lists exactly 3 files: src/settings/store.ts (the `RETIRED_AI_MODELS` key), src/settings/store.test.ts (the carry-over tests), and src/docs/pict-docs.test.ts (a negative check that the help no longer names 5.1). None is user-facing text, so SC-004 ("0 matches in UI, help, README, website") holds.

### Tests for User Story 3 (write first, see them fail) ⚠️

- [X] T019 [US3] Create src/docs/pict-docs.test.ts that imports `DOC_CHAPTERS` from src/docs/pict-docs.ts, joins every chapter's lines into one string, and asserts: it contains `"Haiku 5.5 / Sonnet 5.5 / Opus 5.5 / Fable 5.2"`; it contains `"Fable 5.2"` in the model list and the retention note; and it does not contain `"Fable 5.1"`. Run it and confirm it fails

### Implementation for User Story 3

- [X] T020 [P] [US3] In src/docs/pict-docs.ts, change only the version token on three lines: line ~184 `"AI Model           Haiku 5.5 / Sonnet 5.5 / Opus 5.5 / Fable 5.1"` → `… / Fable 5.2"`; line ~298 `"  Fable 5.1   — most capable, slowest and highest cost"` → `"  Fable 5.2   — …"` (keep the existing separator and column alignment, add no new em dash); line ~305 `"  - Fable 5.1 requires 30-day data retention; organizations on"` → `"  - Fable 5.2 requires …"`
- [X] T021 [P] [US3] In README.md (around lines 183-185), change the model table row `` `claude-fable-5-1` `` → `` `claude-fable-5-2` `` (keep "Most capable, slowest and highest cost"), and the note `Fable 5.1 requires 30-day data retention…` → `Fable 5.2 requires 30-day data retention…`
- [X] T022 [P] [US3] In docs/index.html (around lines 626 and 633), change `<td>claude-fable-5-1</td>` → `<td>claude-fable-5-2</td>` and `Fable 5.1 requires 30-day data retention…` → `Fable 5.2 requires 30-day data retention…`. Leave the markup and styling unchanged
- [X] T023 [P] [US3] In src/ai/client.ts, update the two comments (around lines 96-106). In the thinking comment, "always on for Opus 5.5 and Fable 5.1" becomes "…Fable 5.2". In the effort comment, "Sonnet 5.5 and Fable 5.1 default to "high"" becomes "…Fable 5.2…", which is still accurate (research R1). Comment-only change, no code edits
- [X] T024 [US3] Run `bun test src/docs/pict-docs.test.ts` (green), then `grep -rln "fable-5-1\|Fable 5.1" src README.md docs` and confirm it lists exactly 3 files: src/settings/store.ts, src/settings/store.test.ts and src/docs/pict-docs.test.ts (the last one asserts 5.1 is absent). Count files, not lines, because the test files hold several cases

**Checkpoint**: All docs, help and comments match the shipped models.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 Run the full gate: `bun run typecheck && bun run check && bun run test` (SC-006). Fix any Biome formatting with `bunx biome check --write` on the touched files only
- [X] T026 Walk through specs/001-fable-5-2-support/quickstart.md §0–§2 and §3 steps 1–3 (manual TUI: cycle models, prompt overlay label, help text) and §4 (edit the saved settings file to `claude-fable-5-1`, restart, confirm Fable 5.2, save, confirm the file has `claude-fable-5-2`)
- [X] T027 **Ask the user first** (spends API credit): if they approve, run quickstart §3 step 4, one real Fable 5.2 generation. The offline wire test (T003) already proves the SDK sends `anthropic-version: 2026-10-21`, `Authorization: Bearer` and the right body. This live call adds the one thing a stub can't: that the real API accepts the request for Fable 5.2 and the response parses. If they decline, carry "Live API check: not run (user declined); covered offline by T003" into the T029 commit body and the PR description
- [X] T028 Code and security review of the full branch diff (`git diff main...HEAD`). Check that the key still comes only from src/ai/credentials.ts / `ANTHROPIC_API_KEY` and is never logged; that one credential is passed; that no request fields changed besides `model`; that no new em dashes were added; and that nothing outside the spec changed
- [X] T029 Commit the model and docs work as `feat(ai): Replace Fable 5.1 with Fable 5.2` (body: settings carry-over, docs updated, and the T027 live-check result, either "run, passed" or "not run"), with the specs/ and .specify/feature.json files. If anything non-obvious came up (for example a 1.x type quirk), save it to .claude/memory/ with an index line in .claude/memory/MEMORY.md and commit it with the work. Note for the release process (not this branch's job): ship the SDK's Apache 2.0 license/NOTICE with the compiled dist/ executables, and bump the app version per the usual release flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup. **Blocks all stories.** The SDK must be on 1.x and green first
- **US1 (Phase 3)**: after Phase 2
- **US2 (Phase 4)**: after US1 T012, because `"claude-fable-5-2"` must be an `AiModel` for the `RETIRED_AI_MODELS` value to type-check. Otherwise independent
- **US3 (Phase 5)**: after Phase 2. Runs fully in parallel with US1 and US2, since it only touches docs and comments. Its SC-004 grep (T024) is only clean once US1 is done, because src/types.ts and src/constants.ts still say 5.1 until then
- **Polish (Phase 6)**: after all stories

### Within each story

Tests are written and seen failing → implementation → tests green.

### Parallel Opportunities

- T008, T009 and T010 touch three different test files: [P]
- T020, T021, T022 and T023 touch four different files: [P]
- US3 (T019–T023) can run alongside US1 (T008–T014) once Phase 2 is done

---

## Parallel Example: User Story 1

```bash
# Write all three failing tests at once:
Task: "T008 Update cycle expectation in src/hooks/keyboard/optionsTabHandlers.test.ts"
Task: "T009 Update model passthrough in src/ai/client.test.ts"
Task: "T010 Create src/constants.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T020 Version tokens in src/docs/pict-docs.ts"
Task: "T021 README.md table row + note"
Task: "T022 docs/index.html cell + note"
Task: "T023 Comments in src/ai/client.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (branch, baseline) → Phase 2 (SDK 1.x, own commit)
2. Phase 3 (US1) → **stop and validate**: Fable 5.2 is selectable and sent
3. A shippable MVP. A saved 5.1 choice would fall back to Sonnet 5.5 until US2 lands, so don't release US1 without US2

### Incremental Delivery

1. SDK upgrade commit (Phase 2)
2. US1 + US2 together = the releasable behaviour change
3. US3 = docs consistency
4. Polish, review, commit
