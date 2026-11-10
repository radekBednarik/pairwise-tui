# Data Model: Fable 5.2 AI Model Support

No new entities. Three existing ones change.

## AiModel (`src/types.ts`)

String union of the model IDs the app offers.

| Before | After |
|--------|-------|
| `claude-haiku-5-5` \| `claude-sonnet-5-5` \| `claude-opus-5-5` \| `claude-fable-5-1` | `claude-haiku-5-5` \| `claude-sonnet-5-5` \| `claude-opus-5-5` \| `claude-fable-5-2` |

`AI_MODEL_LABELS` must keep exactly one label per member (it is a `Record<AiModel, string>`, so the compiler enforces this): `"claude-fable-5-2": "Fable 5.2"`.

## AI_MODELS (`src/constants.ts`)

The ordered cycle list for the Options tab: `haiku-5-5 → sonnet-5-5 → opus-5-5 → fable-5-2 → (wrap to haiku-5-5)`. `DEFAULT_AI_MODEL` stays `claude-sonnet-5-5`.

## RETIRED_AI_MODELS (`src/settings/store.ts`)

Maps a model the app used to offer to the model that replaced it. Applied when settings are loaded.

| Saved value | Loaded as |
|-------------|-----------|
| `claude-opus-5` | `claude-opus-5-5` (unchanged) |
| `claude-sonnet-5` | `claude-sonnet-5-5` (unchanged) |
| `claude-haiku-4-5` | `claude-haiku-5-5` (unchanged) |
| `claude-fable-5-1` | `claude-fable-5-2` (**new**) |

**Validation (`asAiModel`)**, unchanged:
1. If the value is a retired key, load its replacement.
2. Otherwise, if it is in `AI_MODELS`, keep it.
3. Otherwise, use the default (`claude-sonnet-5-5`).

Every value in the map must be a member of `AiModel`. The type annotation enforces this.
