# Data Model: Automatic Application Update

## 1. AppSettings (existing, extended)

File: `config.json` in the app config directory. Module: `src/settings/store.ts`.

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `autoUpdate` (new) | boolean | `true` | `asBoolean`; any non-boolean or missing value gives `true` (FR-001) |

All other fields unchanged.

## 2. InstalledVersion

Source: `version` in `package.json`, read through `src/update/version.ts`.

| Field | Type | Rule |
|-------|------|------|
| `major`, `minor`, `patch` | non-negative integers | parsed from `^v?(\d+)\.(\d+)\.(\d+)$`; anything else is not a version |

Comparison is numeric per component. Only *strictly higher* counts as an update (FR-031).

## 3. InstallContext

Computed once at startup, never persisted. Module: `src/update/platform.ts`.

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `"linux" \| "windows" \| "appimage"` | research R3 |
| `targetPath` | string | file to replace |
| `assetName` | string | release asset matching `kind` |
| `fileIdentity` | device + inode of `targetPath` at startup | moved or renamed detection |
| `availability` | `"ok" \| "source-run" \| "unsupported-platform" \| "read-only"` | why self-update is or is not possible |

`availability !== "ok"` and `!== "read-only"` disables checks entirely. `"read-only"` still checks but only notifies (FR-029).

## 4. AvailableUpdate

Built from the release source; cached in the update record.

| Field | Type | Rule |
|-------|------|------|
| `version` | string `X.Y.Z` | higher than installed |
| `tag` | string `vX.Y.Z` | used to build download URLs |
| `notes` | string | sanitized, max 20 000 characters |
| `pageUrl` | string | must start with `https://github.com/radekBednarik/pairwise-tui/releases/` else replaced by the fixed releases page URL |
| `assetName` | string | equals `InstallContext.assetName` |
| `sizeBytes` | positive integer | upper bound for the download |

## 5. UpdateRecord

File: `update.json` in the app config directory. Module: `src/update/state.ts`. Every field is re-validated on load; a corrupt file is treated as empty.

| Field | Type | Meaning |
|-------|------|---------|
| `lastCheckAt` | ISO timestamp or null | last **successful** contact with the release source (FR-006) |
| `available` | AvailableUpdate or null | last found update; dropped when not higher than the installed version |
| `skippedVersion` | string or null | suppresses automatic offers of exactly this version (FR-013) |
| `pending` | PendingUpdate or null | update the user agreed to |
| `installedFrom` | string or null | previous version, set by the install step, cleared after the one-time notice (FR-026) |

### PendingUpdate

| Field | Type | Meaning |
|-------|------|---------|
| `version` | string | version being installed |
| `mode` | `"now" \| "onExit"` | user's choice |
| `sha256` | 64 hex chars or null | set once `<target>.new` is verified; null while downloading |
| `targetPath` | string | must equal the current `InstallContext.targetPath`, else pending is discarded |

## 6. Files beside the app

| File | Lifetime | Rule |
|------|----------|------|
| `<target>.part` | during download | removed at startup, on cancel, on failure (FR-034) |
| `<target>.new` | verified, waiting for install | removed at startup when no matching `pending` with `sha256` exists |
| `<target>.old` | after an install | exactly one, replaced by the next install (FR-028); never removed by cleanup |
| `<target>.update.lock` | during download and install | stale after 1 h or dead PID |

## 7. Update flow states

Held in memory by `useUpdateState`; drives the overlay phase and the Options state row.

```text
idle
 ├─ check (startup, throttled / manual) ──► checking
 │        ├─ none / failed ──────────────► idle        (manual: message; automatic: log only)
 │        └─ found ──────────────────────► offered     (overlay: offer | notice)
 offered
 ├─ Not now ──────────────────────────────► idle        (available stays cached)
 ├─ Skip this version ────────────────────► idle        (skippedVersion set)
 ├─ Update on exit ───────────────────────► downloading(background)
 └─ Update now
        ├─ unsaved work ──────────────────► warned
        │      ├─ Go back ────────────────► offered
        │      ├─ Save model first ───────► downloading(foreground) on successful save
        │      └─ Update on exit instead ─► downloading(background)
        └─ no unsaved work ───────────────► downloading(foreground)
 downloading
 ├─ cancel / failure / mismatch ──────────► idle        (.part removed, error shown)
 ├─ verified, mode now ───────────────────► installing ─► restart
 └─ verified, mode onExit ────────────────► pendingExit
 pendingExit
 ├─ quit ─────────────────────────────────► installing ─► exit
 ├─ autoUpdate turned off ────────────────► idle        (.new removed, FR-033)
 └─ abnormal end ─────────────────────────► (next startup) installing ─► restart
```

Invariants:

- No file beside the app is written before the user leaves `offered` through an "Update" choice (FR-012).
- `installing` is reached only with a `.new` file whose hash was re-checked in the same step.
- Any failure in `installing` leaves `<target>` as either the old or the complete new file (FR-027).
