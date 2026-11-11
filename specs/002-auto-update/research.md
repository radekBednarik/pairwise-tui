# Research: Automatic Application Update

All Technical Context unknowns are resolved below. Findings come from reading the repository, a probe of the local Bun runtime (1.4.2) and the public behaviour of GitHub releases. Items that could not be verified on this machine are marked **UNVERIFIED** and have a validation step in [quickstart.md](./quickstart.md).

## R1. Single version source

- **Decision**: Add a `version` field to `package.json`. `src/update/version.ts` imports it (`import pkg from "../../package.json"`), so the bundler bakes it into every artifact. `scripts/build-windows.ts` reads the same field for the exe metadata. `release.yml` fails the build when the pushed tag is not `v<package.json version>`.
- **Rationale**: Today the version exists only as a literal in `scripts/build-windows.ts`; the Linux executable and the AppImage carry none (FR-035). One field, three readers, one guard.
- **Alternatives considered**: Inject the tag at build time through `define` (the app would show no version when run from source, and local builds would differ from CI). Keep the literal and add a second one (two places to forget).
- **Follow-up**: `.claude/memory/project_release_process.md` says to bump `scripts/build-windows.ts`; it must be updated to "bump `package.json`" in the same commit.

## R2. Telling a released artifact from a source run

- **Decision**: Both build scripts pass `define: { __RELEASE_BUILD__: "true" }`. The updater is enabled only when that constant exists. Run from source (`bun run dev`, `bun run start`, `bun test`) it is absent and every update function is inert (FR-032).
- **Rationale**: Under `bun src/index.tsx`, `process.execPath` is the Bun runtime itself; replacing it would be destructive. A compile-time flag cannot be confused by paths or environment.
- **Alternatives considered**: Inspect `process.execPath` basename or `Bun.main` prefix (`/$bunfs/`): works today but depends on undocumented runtime internals.

## R3. Which file to replace (install kind)

- **Decision**: Three install kinds, each mapped to one release asset and one target path:

  | Kind | Detection | Target file | Asset |
  |------|-----------|-------------|-------|
  | `appimage` | `APPIMAGE` and `APPDIR` are set **and** `process.execPath` lies inside `APPDIR` | path in `APPIMAGE` | `Pairwise-TUI-x86_64.AppImage` |
  | `linux` | `process.platform === "linux"`, not AppImage | `process.execPath` | `pairwise-tui` |
  | `windows` | `process.platform === "win32"` | `process.execPath` | `pairwise-tui.exe` |

  Any other platform or architecture: updater unavailable.
- **Rationale**: Inside an AppImage the executable lives on a read-only mount (`assets/linux/AppRun` execs `usr/bin/pairwise-tui`), so the file to replace is the one named by `APPIMAGE` (FR-024). The `APPDIR` containment check matters because `APPIMAGE` is inherited by child processes: a plain `pairwise-tui` started from a terminal emulator that is itself an AppImage would otherwise overwrite the terminal emulator.
- **Alternatives considered**: Trust `APPIMAGE` alone (unsafe, see above).

## R4. Release source and "is there an update"

- **Decision**: One request to `https://api.github.com/repos/radekBednarik/pairwise-tui/releases/latest` with `Accept: application/vnd.github+json` and a generic `User-Agent: pairwise-tui`, 10 s timeout, response size capped. Use `tag_name`, `body`, `html_url` and the `assets[].name/size` list. An update exists when the tag matches `^v(\d+)\.(\d+)\.(\d+)$`, compares higher than the installed version numerically, and the asset for the install kind plus `SHA256SUMS.txt` are both listed.
- **Rationale**: The `latest` endpoint already excludes drafts and pre-releases (FR-008). Anonymous limit is 60 requests per hour per IP; with the 24 h throttle (R9) one install uses one per day. No user or machine data is sent.
- **Alternatives considered**: Follow the `releases/latest` web redirect to avoid the API (no notes, no sizes, no asset list). List all releases and filter (more data, no benefit).

## R5. Download and integrity

- **Decision**:
  - Download URLs are **built by the app** as `https://github.com/radekBednarik/pairwise-tui/releases/download/<tag>/<asset>`; `browser_download_url` from the API response is not used. Redirects are followed only to `https` URLs.
  - `release.yml` gains a step that writes `SHA256SUMS.txt` (`sha256sum` format: `<64 hex>  <name>`) over the three artifacts and attaches it to the release (FR-016).
  - The app downloads `SHA256SUMS.txt` first (small, size-capped), takes the line for its asset, then streams the artifact to `<target>.part` while feeding a SHA-256 hasher and counting bytes for progress. The download aborts when more bytes arrive than the size announced by the release.
  - Match: rename `.part` to `<target>.new` and record the hash. Mismatch or missing line: delete `.part`, refuse, tell the user (FR-017).
  - Immediately before install, the hash of `<target>.new` is computed again and compared with the recorded one.
- **Rationale**: Building the URL removes the API response as a way to redirect the download elsewhere. Re-hashing before install covers the gap between download and a later "on exit" or next-startup install. Streaming keeps memory flat for a roughly 100 MB file and gives progress and cancel (FR-018) through an `AbortController`.
- **Alternatives considered**: The `digest` field GitHub now attaches to release assets (no workflow change, but not under the project's control, and users cannot verify by hand with a published file). Signatures (out of scope per spec).
- **Limit, stated in the spec**: checksums and artifacts share one origin, so this detects corruption, not a compromised release.

## R6. Replacing the app file

- **Decision**: Staging files live **beside the target** (`<target>.part`, `<target>.new`, `<target>.old`, `<target>.update.lock`). Install happens inside that one directory and differs per system:

  **Linux and AppImage (no gap)**
  1. `chmod 0755` on `<target>.new` (FR-023).
  2. Remove an earlier `<target>.old`, then hard-link `<target>` to `<target>.old`; if linking fails (filesystem without hard links), copy instead (FR-028).
  3. Rename `<target>.new` **over** `<target>`. POSIX rename onto an existing file is atomic, also when that file is a running executable, so a complete file exists at `<target>` at every moment.

  **Windows (one-rename gap)**
  1. Delete an earlier `<target>.old`.
  2. Rename `<target>` to `<target>.old` (the renamed file is the backup).
  3. Rename `<target>.new` to `<target>`.
  4. If step 3 fails, rename `<target>.old` back.
- **Rationale**: Same-directory operations need no copy across filesystems, so the target is never a partial file (FR-027). Linux can replace a running executable in one atomic step. Windows forbids overwriting, deleting or renaming-over a running `.exe` but allows **renaming it away** (FR-025), which forces two steps there. Between Windows steps 2 and 3 no file exists at `<target>`; a forced kill or power loss in that instant leaves `<target>.old` to be restored by hand. The spec accepts this as the single exception to FR-027. Staging beside the target also means "can I update" and "can I write here" are the same question (R7).
- **Windows notes**: an existing `<target>.old` can be locked while a previous version's process is alive; then the install is refused with a message. An install refused at quit is tried once more at the next startup; a refusal at startup is final (the agreed update and its download are dropped, the version is offered again), so a failure can never repeat at every start. This happens by design after "Update now" on Windows: the old process stays as the waiting parent (R8) and holds `.old` for that session, so a second update inside the same session is refused until the app is closed.
- **Alternatives considered**: Download to the temp directory used for `pict` (`$TMPDIR/pairwise-tui-<uid>`): often a different filesystem, so the final step would be a non-atomic copy. A helper script that swaps files after exit: more moving parts, needs a shell, and antivirus tools dislike it.

## R7. Can the app replace itself

- **Decision**: Before offering, create and remove a probe file in the target's directory. Failure means `selfUpdate: unavailable (no write permission)` and the overlay becomes notice-only (FR-029). No elevation is ever attempted (FR-030).
- **Rationale**: `access()` does not reflect ACLs on Windows; an actual write is the only reliable answer on both systems.
- **Moved or renamed app**: device and inode (Windows: file id from `stat`) of the target are recorded at startup and compared before install; a difference refuses the install. Checked on Windows 11 on 2026-11-11 with a compiled probe (task T075): the id is a real file id there, differs between files, changes when a file is replaced by rename and is stable otherwise. The ids are larger than a JavaScript number holds exactly, so they are read as big integers.

## R8. Restarting into the new version

- **Decision**:
  - **Linux and AppImage**: destroy the renderer (restores the terminal), then `process.execve(target, originalArgs, env)`. The process image is replaced in place, same terminal, same PID. Verified: `typeof process.execve === "function"` on Bun 1.4.2. For AppImage, `APPIMAGE`, `APPDIR` and `ARGV0` are removed from the environment first so the new runtime sets its own.
  - **Windows**: no `execve`. Destroy the renderer, stop reading stdin, spawn the new exe with inherited stdio, wait for it and exit with its exit code. The old process stays as an idle parent for that one session.
  - **Fallback (spec edge case)**: if either mechanism throws, exit cleanly and print `Updated to X. Please start pairwise-tui again.`
- **UNVERIFIED**: Windows console behaviour of parent-waits-child with a raw-mode TUI. Quickstart V8 validates it; if input is unreliable, Windows uses the fallback permanently. The spec allows this.
- **Spike result, 2026-11-11 (task T002)**: run on Windows 11 through WSL interop with a compiled `bun-windows-x64` exe. **Verified**: a running exe can be renamed away and a new file renamed into its place; deleting the locked old file fails with `EPERM`; the locked old file can still be renamed; a child spawned with inherited stdio runs from the new file and its exit code reaches the parent; the old file can be deleted once the process has ended. **Not verified**: keyboard input of a raw-mode TUI in the waited child, because the interop session has no interactive console. The waited-child design stays, with the fallback message; quickstart V8 (task T070) decides on a real Windows terminal.
- **Console hand-over (task T072)**: before the child is started, the parent switches raw mode off and pauses and unrefs stdin itself, not relying on the renderer having done so. Whether the child then receives every key press is still to be seen on a real Windows terminal (T070).
- **Alternatives considered**: Detached spawn and exit on Windows (the shell prompt returns and fights the new app for the console).

## R9. Check cadence and persisted state

- **Decision**: A separate file `update.json` in the existing config directory (`getAppConfigPath`) holds the update record ([data-model.md](./data-model.md)). The startup check contacts the release source only when `lastCheckAt` (last success) is older than 24 h **and** `lastAttemptAt` (last attempt, successful or not) is older than 1 h, so an offline or rate-limited machine retries at most hourly (FR-006, SC-008). The last found update is cached in that file, so a version answered with "Not now" is re-offered at next startup without a network call, and it is also offered when a due check fails (FR-006). The `autoUpdate` boolean itself goes into `config.json` with the other settings (FR-001); the existing loader gives old files the default `true`.
- **Rationale**: Settings are rewritten on every settings change by an effect in `App.tsx`; machine-written bookkeeping in the same file would race with it. A second file keeps user settings clean.
- **Alternatives considered**: Everything in `config.json` (write races, noisy file).

## R10. Install on exit and at next startup

- **Decision**:
  - "Update now" also records its agreement: `pending { mode: "now" }` is saved when the download starts and gets its `sha256` after verification, so a kill between verification and install is finished at next startup like an "on exit" update (FR-022).
  - All quit paths, including the `Ctrl+C` handler in `useAppKeyboard.ts`, go through one `quit()` in `App.tsx`: if a pending update is verified, run the install (R6) and then `renderer.destroy()`. Quit never waits for a running download: it is aborted and `.part` removed (FR-021).
  - `src/index.tsx` runs a startup step **before** `createCliRenderer`: clean leftovers (FR-034), then, if `update.json` has a verified pending update and `<target>.new` exists with the recorded hash, install and restart (R8). The new process sees `installedFrom` in `update.json` and shows the one-time notice (FR-022, FR-026).
- **Rationale**: Installing before the renderer exists avoids a flash of the old interface and needs no terminal teardown. A process killed by the terminal closing gets no chance to run exit code, so next-startup install is the only reliable recovery.

## R11. Several running copies

- **Decision**: Download and install take `<target>.update.lock`, created with exclusive-create and containing the PID and a timestamp. A lock is stale, and removed, only when its PID is not alive. Age is used only when liveness cannot be determined (unreadable lock content, or the liveness call itself fails): then a lock older than 1 hour is stale. A live but slow download therefore never loses its lock. One bound applies regardless: a lock older than 24 hours is always stale, because a pid can be reused by an unrelated process (above all after a reboot) and would otherwise keep a dead lock alive forever. Startup cleanup respects a live lock too: it removes nothing while another copy is downloading.
- **Takeover of a stale lock** is guarded by a short-lived second file, `<target>.update.lock.takeover` (exclusive-create). Only its holder may remove the stale lock and create a new one, after judging staleness again; everyone else simply does not get the lock this time. Without it, two copies that both judged the lock stale could each delete "the stale lock", the second deleting the first's fresh one. A takeover file left by a crash is cleared after 30 s. A lock dated more than a minute in the future is stale. A lock is released only by the process that holds it. Lock and record files are read only when they are regular files of plausible size, so a FIFO put in their place cannot block startup. A copy that cannot take the lock does not download or install; it reports "another copy is updating" in the message log.

## R12. Unsaved work

- **Decision**: No dirty tracking exists today. Add: (a) the serialized model text at the last save, open or clear is kept in a ref and compared with the current serialization; (b) a flag set when results are generated and cleared when they are saved. Unsaved work = (a) differs or (b) set. "Save model first" calls the existing `handleSaveModel`.
- **Rationale**: `serialize` in `src/pict/model.ts` already yields a canonical text, so no per-field tracking is needed.

## R13. Interface integration

- **Decision**:
  - One new overlay kind `update` in `src/utils/overlay.ts`, lowest precedence, rendered by `UpdateOverlay.tsx` with phases: `offer`, `notice` (read-only install), `unsavedWarning`, `downloading`, `error`.
  - Automatic appearance goes through the existing `useDeferredScreenChange` hook, which already delays screen changes until no overlay is open and no text field is active (FR-014).
  - Options tab gets an "Updates" section: version row (static), `autoUpdate` toggle, `checkUpdates` action, state row (static). The two interactive fields are added to `OPTION_FIELDS` before `none`.
  - Keys are handled by a new `handleUpdateKeys` in `modalHandlers.ts`, same pattern as `handleClearConfirmKeys`.
- **Release notes safety**: the notes are remote text shown in a terminal. All control characters except newline and tab are stripped (this removes escape sequences), as are bidirectional overrides and invisible characters (they can make text read differently from what it is), and the text is capped at 20 000 characters. This happens when the notes are received **and again** when they are read back from `update.json`. Shown as plain text in a scrollbox; markdown is not rendered. The release page address is rebuilt from its parsed parts: only an https address on `github.com` under this project's releases, without credentials, query or fragment and at most 300 characters, is shown; anything else becomes the fixed releases page.

## R14. Testing approach

- **Decision**: Every updater module takes its environment as parameters (`fetch`, clock, target path, platform, env), with real defaults. Tests use temporary directories for file swaps and a local `Bun.serve` instance as a fake release source. UI flows use `renderTest`. Nothing in the test suite contacts GitHub.
- **Manual rig**: the build scripts accept `UPDATE_SOURCE_OVERRIDE` and bake that address in through `define`. It is a build-time value only; a released artifact has no runtime way to change where updates come from. `release.yml` fails if the variable is set.
- **Compiled executables read no configuration from the current directory** (found by the security review, predates this feature): by default a Bun executable loads `.env` and `bunfig.toml` from the directory it is started in. A `bunfig.toml` there could preload and run code, and a `.env` could set a proxy or switch off certificate checks for the update download. Both build scripts now pass `autoloadDotenv: false`, `autoloadBunfig: false` (and the tsconfig and package.json equivalents). Verified with two compiled probes: the default build picked up both files, the hardened build neither. Update requests also state `rejectUnauthorized: true` explicitly.
- **Size bound**: an artifact announced as larger than 500 MB is not an update (builds are about 110 MB), so a bad size cannot fill the disk. The download also gives up when the server sends nothing for 30 s, including before its first answer.
- **Not automatable here**: real restart, AppImage mount behaviour and Windows file locking. These are the manual scenarios in the quickstart.
