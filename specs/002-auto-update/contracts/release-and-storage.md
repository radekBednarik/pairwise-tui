# Contract: Release Source, Release Assets and Stored Files

## S1. What the app requests

| Purpose | Request | When |
|---------|---------|------|
| Check | `GET https://api.github.com/repos/radekBednarik/pairwise-tui/releases/latest` | startup if `autoUpdate` is on, the last successful check is older than 24 h and the last attempt is older than 1 h; manual check |
| Checksums | `GET https://github.com/radekBednarik/pairwise-tui/releases/download/<tag>/SHA256SUMS.txt` | after the user chose an Update option |
| Artifact | `GET https://github.com/radekBednarik/pairwise-tui/releases/download/<tag>/<asset>` | after the checksum line was found |

Rules:

- Headers: `Accept: application/vnd.github+json` (check only), `User-Agent: pairwise-tui`. No token, no cookies, no query parameters, no user or machine data.
- `https` only, including every redirect target.
- Timeouts: 10 s for check and checksums; the artifact download has no total limit but fails after 30 s without data.
- Response caps: 1 MB for the check, 64 KB for checksums, the announced asset size for the artifact.
- With `autoUpdate` off and no manual check, none of these requests is ever made.

## S2. What the app reads from the check response

| JSON field | Use | If invalid |
|------------|-----|-----------|
| `tag_name` | must match `^v\d+\.\d+\.\d+$` | no update |
| `draft`, `prerelease` | must both be `false` | no update |
| `body` | release notes after sanitizing | empty notes |
| `html_url` | shown as the download page | fixed releases page URL |
| `assets[].name`, `assets[].size` | asset for the install kind and `SHA256SUMS.txt` must be present | no update |

Other fields, including `browser_download_url`, are ignored.

## S3. Release assets (release workflow contract)

Every release from this feature on MUST attach:

| Asset | Notes |
|-------|-------|
| `pairwise-tui` | unchanged |
| `pairwise-tui.exe` | unchanged |
| `Pairwise-TUI-x86_64.AppImage` | unchanged |
| `THIRD-PARTY-NOTICES.txt` | unchanged |
| `SHA256SUMS.txt` (new) | one line per artifact above except the notices file: `<64 lowercase hex><two spaces><asset name>` |

Asset names are part of this contract: renaming one cuts existing installations off from updates.

The workflow MUST fail before building when the tag is not `v` + the `version` in `package.json`.

## S4. `update.json`

Location: the app config directory, next to `config.json`. Shape as in [data-model.md](../data-model.md) section 5.

- Written only by the app; a missing or unreadable file equals an empty record.
- Unknown fields are dropped on the next write.
- Contains no secrets.

## S5. Files beside the app

`<target>` is the plain executable, the `.exe`, or the `.AppImage` file.

| File | Created by | Removed by |
|------|-----------|-----------|
| `<target>.part` | download | cancel, failure, startup cleanup |
| `<target>.new` | successful verification | install, startup cleanup when not pending, turning `autoUpdate` off |
| `<target>.old` | install | next install only |
| `<target>.update.lock` | download or install | the same step when it ends; startup cleanup when stale |

Guarantees:

- Linux and AppImage: `<target>` is at every instant either the complete previous version or the complete new version (replaced in one atomic step).
- Windows: the same holds before and after an install and after any failed install. Only an interruption between its two renames leaves no file at `<target>`; the complete previous version is then `<target>.old`.
- The lock is treated as stale when its owning process is dead (by age of 1 h when that cannot be determined), and in any case after 24 h.
- No update step requests elevated rights.
- On Linux and for the AppImage, `<target>` has mode `0755` after an install.
- No other path is written by the updater, apart from `update.json`.

## S6. Restoring the previous version (documented in README)

- Linux: `mv pairwise-tui.old pairwise-tui` (AppImage: the same with the `.AppImage` name).
- Windows: delete `pairwise-tui.exe`, rename `pairwise-tui.exe.old` to `pairwise-tui.exe`.
- Then turn automatic updates off or choose "Skip this version" when the broken release is offered again.
