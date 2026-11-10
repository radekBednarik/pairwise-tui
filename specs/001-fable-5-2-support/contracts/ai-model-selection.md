# Contract: AI Model Selection

The app's external surface for this feature: what the user sees, what is persisted, and what is sent to the Claude API.

## C1. Options tab: AI Model field

- Pressing `Enter` on the field cycles: `Haiku 5.5 → Sonnet 5.5 → Opus 5.5 → Fable 5.2 → Haiku 5.5`.
- Labels shown exactly as `Haiku 5.5`, `Sonnet 5.5`, `Opus 5.5`, `Fable 5.2`.
- `Fable 5.1` never appears.

## C2. AI prompt overlay

- It names the selected model's label, for example `Fable 5.2`.

## C3. Persisted settings (`aiModel` key)

| Stored on disk | Selected after load | Written on next save |
|----------------|---------------------|----------------------|
| `claude-fable-5-2` | Fable 5.2 | `claude-fable-5-2` |
| `claude-fable-5-1` | Fable 5.2 | `claude-fable-5-2` |
| `claude-opus-5` / `claude-sonnet-5` / `claude-haiku-4-5` | Opus 5.5 / Sonnet 5.5 / Haiku 5.5 | the new ID |
| anything else, or missing | Sonnet 5.5 | `claude-sonnet-5-5` |

## C4. Claude API request (Fable 5.2 selected)

A streamed `messages` request that is identical to the current one except for `model`:

- `model: "claude-fable-5-2"`
- `max_tokens: 64000`
- `output_config.effort: "high"` plus the existing JSON-schema `format`
- no `thinking` field, no `temperature`, no forced `tool_choice`

Transport, after the SDK upgrade (applies to all four models):

- header `anthropic-version: 2026-10-21` (was `2023-06-01`), set by the SDK default with no override in code
- the API key goes in `Authorization: Bearer <key>` (was `X-Api-Key`)
- endpoint, body fields and streaming behaviour are unchanged

Error responses (for example `400` for zero data retention organizations) are shown through the existing AI error path. No new handling is added.

## C5. Documentation text

| Location | Required text |
|----------|---------------|
| In-app help, Options section | `AI Model           Haiku 5.5 / Sonnet 5.5 / Opus 5.5 / Fable 5.2` |
| In-app help, AI section | `Fable 5.2   — most capable, slowest and highest cost` and a retention note naming Fable 5.2 |
| README model table | row `claude-fable-5-2` / "Most capable, slowest and highest cost", and a retention note naming Fable 5.2 |
| `docs/index.html` | table cell `claude-fable-5-2`, and a retention note naming Fable 5.2 |
