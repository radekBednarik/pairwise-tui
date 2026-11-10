# Research: Fable 5.2 AI Model Support

All Technical Context items were known from the codebase and the Claude API reference. Nothing was left as NEEDS CLARIFICATION. The decisions below record what was checked.

## R1. Does the request need to change for Fable 5.2?

- **Decision**: No. Change only the model identifier.
- **Rationale**: `src/ai/client.ts` sends no `thinking` field, `output_config.effort: "high"`, `max_tokens: 64000`, streamed. Fable 5.2 keeps the Fable 5.1 surface for everything the app uses. Thinking is always on, so leaving the field out is correct, and an explicit `disabled` or `budget_tokens` would return 400. The effort levels are `low` to `max`, defaulting to `high`. Output goes up to 128K. The app uses no prefill, forced `tool_choice`, advisor or computer-use tools, so none of Fable 5.2's breaking changes from 5.1 (the history-editing check on every account, thinking blocks tied to their account, the computer tool version, advisor pairing) affect it. Each call is a single turn.
- **Alternatives considered**: Re-tuning effort for Fable 5.2. The reference suggests starting at `high` for Fable 5.2, which is what `EFFORT` is already pinned to. Rejected as out of scope.

## R2. Anthropic SDK upgrade (0.129.0 → 1.7.0)

- **Decision**: Upgrade `@anthropic-ai/sdk` from `^0.129.0` to `^1.7.0` (the npm `latest` tag on 2026-11-10), keeping the caret pin style, and regenerate `bun.lock` with `bun install`. The user requested this after the first plan, which had kept 0.129.
- **Why it matters**: 1.0.0 is the first TypeScript release that sends API version `2026-10-21` instead of `2023-06-01`. The upgrade therefore follows the API-version migration (guide: https://platform.claude.com/docs/en/api/migration-2026-10-21), not just a dependency bump.
- **Note**: 0.129 would not have blocked Fable 5.2. Its `Model` type is `known IDs | (string & {})`, so any ID type-checks, and `claude-haiku-5-5` already works that way.

### API-version changes 1-4: inventory (searches run over `src/`)

| Change | Search | Hits | Action |
|--------|--------|------|--------|
| 1. `temperature` / `top_p` / `top_k` removed | `temperature\|top_p\|topP\|top_k\|topK\|extra_body` | none | nothing to do, and no **[DECIDE]** triggered |
| 2. `document` in assistant messages | `"document"`, `DocumentBlockParam` | none | none. The app sends one `user` message |
| 3. `citations` on user text | `citations`, `search_result` | `src/ai/client.test.ts:35`, a *response* text-block fixture (`citations: null`) | leave. It's assistant-side response data, not user input |
| 4. Admin / Analytics fields | `rbac`, `rate_limits`, `api_keys`, `organization` | only the help text "organizations on" | unrelated word, leave |
| Bedrock older-model note | Bedrock clients | none. First-party client only | n/a |
| explicit `anthropic-version` | `anthropic[-_]version` | none | nothing to remove |

### Change 5: SDK breaking changes (TypeScript section read verbatim from the guide)

| Change | Applies? | Why |
|--------|----------|-----|
| `MessageParam` is a per-role union | No edit expected | `client.ts` builds `{ role: "user", content: prompt }` inline, which type-checks as before. `tsc` after the upgrade confirms it, including the test fixtures |
| Client-side compaction removed from tool runner | No | no tool runner |
| Text Completions removed | No | Messages only |
| `betas` removed from non-beta Models methods | No | Models API not used |
| API key sent as `Authorization: Bearer` | Behaviour change only | `new Anthropic({ apiKey })` with no `baseURL`, proxy or `X-Api-Key` header anywhere (searched), so no **[DECIDE]**. The Claude API accepts both headers |
| A client holds one credential | No edit | exactly one credential (`apiKey`) is passed, so no `TypeError` risk. Passing it explicitly already means the env/disk are not consulted |
| License is Apache 2.0 | Note only | The project is MIT and the SDK is now Apache 2.0, which is compatible. The compiled executables in `dist/` bundle the SDK, so release artifacts should carry its license or NOTICE (Apache 2.0 §4). This is flagged for the release process, not code |

Nothing in the fetched page asked for anything outside the skill's list.

- **Peer dependency**: `zod` is still an *optional* peer (`peerDependenciesMeta.zod.optional: true`), the same as 0.129, so nothing is added.
- **Platform packages**: none are used (`@anthropic-ai/bedrock-sdk` etc.), so there's no risk of a second SDK copy.
- **`AiClient` injection seam** (`client.ts:110-116`): it types against `Anthropic.MessageStreamParams` and `Anthropic.Message`. Both names still exist in 1.x, and `tsc` verifies this.
- **Verification**: an offline wire test stubs `globalThis.fetch` and checks the headers and body the real default client sends, failing on 0.129 and passing on 1.x (tasks T003), so FR-011 is verified without credentials. The live check is still optional and costs money, so it is **[DECIDE]**: ask the user before sending one real request (quickstart §3 step 4). It only adds proof that the API accepts Fable 5.2
- **Alternatives considered**: Staying on 0.x, which the user rejected. Pinning `^1.0.0`, rejected because the newest release carries the most recent fixes and the caret allows 1.x updates anyway.

## R3. How should saved Fable 5.1 settings be handled?

- **Decision**: Add `"claude-fable-5-1": "claude-fable-5-2"` to `RETIRED_AI_MODELS` in `src/settings/store.ts`.
- **Rationale**: This is the pattern already used for Opus 5, Sonnet 5 and Haiku 4.5. `asAiModel` checks the retired map before checking validity, so the carry-over happens on load and the next save writes the new ID (FR-004).
- **Alternatives considered**: Letting the unknown value fall back to the default (Sonnet 5.5). Rejected: it silently downgrades users who chose the top model (spec User Story 2).

## R4. Which mentions change, and which stay?

- **Decision**: Change every Fable 5.1 reference in source, tests, in-app help, README and website, except the new retired-map key.
- **Inventory** (from `grep -rni fable`, excluding `node_modules`, `dist`, `specs`, `.specify`):
  - `src/types.ts`: `AiModel` union member and `AI_MODEL_LABELS` entry
  - `src/constants.ts`: `AI_MODELS` entry
  - `src/ai/client.ts`: two comments (the thinking note and the effort-defaults note)
  - `src/docs/pict-docs.ts`: Options-tab model list line 184, AI model list line 298, retention note line 305
  - `README.md`: model table row line 183, retention note line 185
  - `docs/index.html`: table cell line 626, retention note line 633
  - Tests: `src/hooks/keyboard/optionsTabHandlers.test.ts:116`, `src/ai/client.test.ts:44,47`
- **Unchanged**: `CLAUDE.md` and `.claude/memory/` contain no Fable references. There is no CHANGELOG file. Past commit messages are history.
- **Note on style**: the in-app help lines use an existing em dash as a column separator. Only the version token changes, and no new em dash is written (org rule). Reformatting the list is out of scope.

## R5. Is the docs wording still accurate?

- **Decision**: Keep "most capable, slowest and highest cost" and the 30-day retention / ZDR note. Swap only the version.
- **Rationale**: Fable 5.2 is $8/$40 per MTok compared with $10/$50 for Fable 5.1. That's cheaper, but still above Opus 5.5 ($4/$20), so "highest cost" holds. The reference states that Fable 5.2 still requires 30-day retention and returns `400 invalid_request_error` for ZDR organizations. "Most capable widely released model" still holds.
