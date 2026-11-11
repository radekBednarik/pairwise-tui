# Contract: Update User Interface

What the user sees and can press. Wording is binding for tests; layout is not.

## U1. Options tab: "Updates" section

Placed after "AI Settings".

| Row | Kind | Content |
|-----|------|---------|
| Version | static | `Version` + installed version, e.g. `1.8.0` |
| Automatic updates | toggle, field `autoUpdate` | `ON` / `OFF`, hint `[Enter] toggle` when focused |
| Check for updates now | action, field `checkUpdates` | hint `[Enter] check` when focused |
| State | static, only when applicable | one of the lines in U2 |

`Tab` order: existing fields, then `autoUpdate`, `checkUpdates`, then `none`.

When self-update is unavailable because of a source run or unsupported platform, both interactive rows are shown dimmed, `Enter` does nothing, and the state row explains why.

## U2. State row texts

| Condition | Text |
|-----------|------|
| Pending for exit, downloading | `Downloading X.Y.Z, will install on exit` |
| Pending for exit, verified | `X.Y.Z will be installed on exit` |
| Read-only install | `Self-update unavailable: no write permission for the app's folder` |
| Run from source | `Updates unavailable when running from source` |
| Unsupported platform | `Updates unavailable on this platform` |
| Last check failed | `Last update check failed: <reason>` |

## U3. Manual check results (status message)

| Outcome | Message |
|---------|---------|
| Up to date | `You are up to date (X.Y.Z)` |
| Failed | `Update check failed: <reason>` |
| Found | no message; overlay U4 or U5 opens |

The manual check ignores the 24 h limit and `skippedVersion`.

## U4. Update overlay, phase `offer`

Shows: title `Update available`, `Installed: A.B.C`, `New: X.Y.Z`, `Download size: N MB`, release notes in a scrollable area.

| Key | Action |
|-----|--------|
| `Left` / `Right` or `Tab` | move between choices |
| `Enter` | confirm the highlighted choice |
| `Up` / `Down`, `PgUp` / `PgDn` | scroll release notes |
| `Esc` | same as `Not now` |

Choices, in order: `Update now`, `Update on exit`, `Not now`, `Skip this version`. `Not now` is highlighted initially.

Global shortcuts (`q`, `g`, `s`, `o`, `w`, tab switching) are inactive while the overlay is open.

The overlay opens by itself only when no other overlay is open and no text field is active; otherwise it waits.

## U5. Update overlay, phase `notice` (app cannot replace itself)

Same information as U4 plus `Download: <release page address>` and the line `This installation cannot update itself (no write permission).`

Choices: `Close` (initial, also `Esc`), `Skip this version`.

## U6. Phase `unsavedWarning`

Text: `Restarting will discard unsaved work.`

Choices: `Go back` (initial, also `Esc`), `Save model first`, `Update on exit instead`.

`Save model first` runs the normal model save. If the save fails, the warning stays and the save error is shown.

## U7. Phase `downloading` (only for "Update now")

Shows `Downloading X.Y.Z` with percentage and bytes, then `Verifying`, then `Installing`.

| Key | Action |
|-----|--------|
| `Esc` | cancel the download, return to phase `offer`; ignored once `Installing` is shown |

## U8. Phase `error`

Shows one of:

| Cause | Text |
|-------|------|
| Checksum mismatch | `Update not installed: the download failed verification.` |
| Checksum not published | `Update not installed: this release has no checksum.` + release page address |
| Network or storage failure | `Update failed: <reason>` |
| File moved, locked, or other copy updating | `Update not installed: <reason>` |

Single choice `Close` (`Enter` or `Esc`). The installed version keeps running.

## U9. After an update

On the first start of the new version, one status message: `Updated to X.Y.Z (previous version kept as <backup file name>)`.

If automatic restart is not possible, the old process prints after leaving the interface: `Updated to X.Y.Z. Please start pairwise-tui again.`

## U10. Quit with a pending update

`q` with a verified pending update installs it and exits, with no extra prompt. `q` during a background download exits at once and installs nothing.
