# Quickstart: Validate Fable 5.2 Support

## Prerequisites

- Bun installed, dependencies installed (`bun install`)
- Optional, for the live check: an Anthropic API key from an organization with 30-day data retention (not ZDR)

## 0. SDK upgrade check

```bash
bun pm ls | grep @anthropic-ai/sdk   # exactly one entry, 1.x
grep -n '"@anthropic-ai/sdk"' package.json   # "^1.7.0"
grep -rnE -i "temperature|top_p|top_k|x-api-key|anthropic[-_]version" src   # no hits
```

## 1. Automated checks

```bash
bun run test        # all suites pass, including the updated model tests
bun run check       # Biome clean
bun run typecheck   # tsc clean (AiModel / AI_MODEL_LABELS stay in sync)
```

The tests should cover:
- cycling from Opus 5.5 selects `claude-fable-5-2`, and cycling from Fable 5.2 wraps to Haiku 5.5 (contract C1)
- a generation with `claude-fable-5-2` sends `model: "claude-fable-5-2"` (C4)
- saved `claude-fable-5-1` loads as `claude-fable-5-2`, and the existing retired-model cases still pass (C3)

## 2. Leftover-reference check (SC-004)

```bash
grep -rln "fable-5-1\|Fable 5.1" src README.md docs
```

Expected: exactly **3 files**:
- `src/settings/store.ts`, the `RETIRED_AI_MODELS` key
- `src/settings/store.test.ts`, the carry-over tests (several lines, so count files, not lines)
- `src/docs/pict-docs.test.ts`, which asserts the help no longer mentions Fable 5.1

None is user-facing text, so SC-004 holds. Any other file in the list is a missed update.

## 3. Manual TUI check

```bash
bun run start
```

1. Press `2` (Options), tab to **AI Model**, press `Enter` repeatedly. You should see Haiku 5.5 → Sonnet 5.5 → Opus 5.5 → Fable 5.2 → Haiku 5.5.
2. Select Fable 5.2, open the AI prompt overlay, and confirm it names "Fable 5.2".
3. Open the help and confirm the Options and AI sections name Fable 5.2.
4. (Live, optional, spends a little API credit: ask first) The offline wire test in `src/ai/client.test.ts` already checks the API version, `Authorization` header and body. This step only confirms the real API accepts Fable 5.2 and the response parses. With a valid key, submit a short prompt such as "login form with username, password, remember me". A model loads into the Model tab.

## 4. Carry-over check (C3)

Quit the app, set `"aiModel": "claude-fable-5-1"` in the saved settings file, and restart. The Options tab shows Fable 5.2. Save settings, and the file now contains `claude-fable-5-2`.
