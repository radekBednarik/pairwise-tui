---

description: "Task list for the automatic application update feature"
---

# Tasks: Automatic Application Update

**Input**: Design documents from `/specs/002-auto-update/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/update-interface.md, contracts/release-and-storage.md, quickstart.md

**Tests**: Included. The project works test-first (project memory: failing tests, then code, then a code and security review).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: Which user story the task belongs to (US1 to US7)

## Implementation notes (added while implementing)

- The flow state machine was built as `src/update/controller.ts` (a plain class) with `src/hooks/useUpdateState.ts` as a thin subscriber, see plan.md "Deviation found during implementation". Wherever a task below names `src/hooks/useUpdateState.ts` for flow logic or `src/hooks/useUpdateState.test.tsx` for flow tests, read `src/update/controller.ts` and `src/update/controller.test.ts`.
- Two helper modules were added: `src/update/errors.ts` and `src/update/http.ts`; build defines are shared in `scripts/build-common.ts`.
- Test-first was kept for the foundation and the four core modules (tests seen failing first). For `startup.ts`, `controller.ts` and the keyboard handlers the tests were written in the same step as the code and were not seen failing first; one mutation spot-check on the controller's retry throttle confirmed the suite catches a broken rule.
- T019 gained one rule beyond the task text: a lock older than 24 h is stale even with a live pid (pid reuse).

## Conventions for every task

- Run commands from the repo root with Bun (`bun run test`, `bun run check`, `bun run typecheck`).
- Biome style: tabs, double quotes.
- **Never write an em dash** in new or edited text (org rule). Use a spaced en dash in prose, a plain hyphen in code and commit messages.
- Before touching any `.tsx` file or keyboard handler, load the `opentui` skill (project memory).
- Each test task must be run and seen failing before its implementation task starts.
- Modules in `src/update/` import nothing from React or OpenTUI. Each exported function takes its environment (`fetch`, `now`, paths, `platform`, `env`) as an options parameter with real defaults (research R14). Tests never contact GitHub.
- No shell invocation anywhere in the updater (`Bun.$`, `spawn` of a shell). The only spawn is the Windows restart of the app's own file.
- Don't change behaviour outside the spec: existing settings, shortcuts and overlays keep working exactly as now.
- Exact user-facing texts are in contracts/update-interface.md; use them verbatim.

---

## Phase 1: Setup

**Purpose**: Clean starting point and the Windows restart answer the design depends on.

- [X] T001 Confirm branch `002-auto-update` is checked out and clean, then record the baseline: run `bun run typecheck && bun run check && bun run test` and note pass/fail counts
- [X] T002 Spike the Windows restart (research R8, open risk in plan.md): in a temporary directory **outside the repository** write a throwaway `restart-spike.ts` that creates a renderer, on a key press destroys it, pauses stdin, spawns its own compiled exe with `stdio: "inherit"`, awaits exit and exits with the child's code. Compile with `bun build --compile --target=bun-windows-x64`, run the `.exe` from this WSL machine through Windows interop in a Windows terminal, and check that the child receives keyboard input correctly. In the same spike prove the Windows file swap of research R6 on a real running exe: while it runs, rename it to `<name>.old`, rename a second copy into its place, confirm both renames succeed, that deleting the locked `.old` fails with a recognisable error, and that the `.old` can be deleted once the process has ended. Record both outcomes as a dated note under R8 in specs/002-auto-update/research.md: either "verified" or "Windows uses the fallback message". Later tasks T020, T027 and T070 follow that note. If the spike cannot be run, record that and keep the waited-child design with the fallback

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Version source, release flag, setting, stored record, install context and the overlay slot. Every story needs these.

**⚠️ CRITICAL**: No user-story work starts until T016 is green.

- [X] T003 Add `"version": "1.7.0"` to package.json (after `"name"`). In scripts/build-windows.ts replace the literal `version: "1.7.0"` with the value read from package.json (`import pkg from "../package.json"`). Check `tsconfig.json` allows JSON imports (`resolveJsonModule`); enable it if not
- [X] T004 [P] Write failing tests in src/update/version.test.ts: `parseVersion` accepts `1.2.3` and `v1.2.3`, rejects `1.2`, `v1.2.3-beta`, `1.2.3.4`, empty string and non-strings (data-model section 2: pattern `^v?(\d+)\.(\d+)\.(\d+)$`); `isNewer(a, b)` compares numerically per component (`1.10.0` newer than `1.9.9`), equal is not newer, lower is not newer; `INSTALLED_VERSION` equals the package.json version
- [X] T005 Implement src/update/version.ts: `INSTALLED_VERSION` from `import pkg from "../../package.json"`, `parseVersion`, `isNewer`, and `IS_RELEASE_BUILD = typeof __RELEASE_BUILD__ !== "undefined"` (declare the global in a `src/update/globals.d.ts`). Make T004 pass
- [X] T006 In scripts/build-linux.ts and scripts/build-windows.ts add `define: { __RELEASE_BUILD__: "true" }` to the `Bun.build` call. Also read `process.env.UPDATE_SOURCE_OVERRIDE`; when set, add `__UPDATE_SOURCE_OVERRIDE__: JSON.stringify(value)` to `define` and print a visible warning line (research R14). Build once with `bun run build:dist:linux` and confirm it succeeds
- [X] T007 [P] Write failing tests in src/settings/store.test.ts: `DEFAULT_SETTINGS.autoUpdate` is `true`; a config file without the key loads `autoUpdate: true`; `false` round-trips; a non-boolean value (`"no"`, `0`, `null`) loads `true` (FR-001, data-model section 1)
- [X] T008 Add `autoUpdate: boolean` to `AppSettings`, `DEFAULT_SETTINGS` (`true`) and `loadSettings` (`asBoolean`) in src/settings/store.ts. Make T007 pass
- [X] T009 [P] Write failing tests in src/update/state.test.ts for `loadUpdateRecord` / `saveUpdateRecord` (file `update.json` via `getAppConfigPath`, path injectable): missing or corrupt file gives the empty record (all fields null); each field is validated on load per data-model section 5: `lastCheckAt` and `lastAttemptAt` must each parse as a date else null; `skippedVersion` and `installedFrom` must pass `parseVersion` else null; `available` requires a valid `version`, `tag` equal to `v` + version, string `notes` (max 20 000 characters, longer is truncated), `pageUrl` starting with `https://github.com/radekBednarik/pairwise-tui/releases/` (else replaced by `https://github.com/radekBednarik/pairwise-tui/releases`), non-empty `assetName`, positive integer `sizeBytes`, else `available` is null; `pending` requires valid `version`, `mode` in `"now" | "onExit"`, `sha256` either null or exactly 64 lowercase hex chars, string `targetPath`, else null; unknown fields are dropped on save; save creates the directory
- [X] T010 Implement src/update/state.ts with the `UpdateRecord`, `AvailableUpdate` and `PendingUpdate` types and the two functions. Make T009 pass
- [X] T011 [P] Write failing tests in src/update/platform.test.ts for `resolveInstallContext({ platform, arch, env, execPath, isReleaseBuild })` (research R3, data-model section 3): not a release build gives `availability: "source-run"`; linux x64 gives kind `linux`, target = execPath, asset `pairwise-tui`; win32 x64 gives kind `windows`, asset `pairwise-tui.exe`; `APPIMAGE` + `APPDIR` set and execPath inside `APPDIR` gives kind `appimage`, target = `APPIMAGE`, asset `Pairwise-TUI-x86_64.AppImage`; `APPIMAGE` set but execPath outside `APPDIR` (or `APPDIR` unset) gives kind `linux` with target = execPath (the guard); darwin or arm64 gives `"unsupported-platform"`. For `probeWritable(dir)` in a temp dir: writable dir gives true and leaves no probe file; a dir with mode `0o500` gives false (skip this case on win32). For `fileIdentity(path)`: same file twice is equal; after replacing the file by rename it differs
- [X] T012 Implement src/update/platform.ts: `resolveInstallContext`, `probeWritable` (create and remove a uniquely named probe file with exclusive-create), `fileIdentity` (`dev` + `ino` from `stat`), and `getInstallContext()` that resolves once and caches, setting `availability` to `"read-only"` when the probe fails. Make T011 pass
- [X] T013 [P] Write failing tests in src/utils/overlay.test.ts: `resolveActiveOverlay` returns `"update"` when only `updateOpen` is set, and any other set flag wins over it (lowest precedence, research R13)
- [X] T014 Add `"update"` to `OverlayKind`, `updateOpen` to `OverlayFlags` and a last entry to `OVERLAY_PRECEDENCE` in src/utils/overlay.ts. Pass `updateOpen: false` at the call site in src/App.tsx for now. Make T013 pass
- [X] T015 Create src/hooks/useUpdateState.ts as a skeleton following the `useModalState` pattern: state `phase: "idle" | "checking" | "offer" | "notice" | "unsavedWarning" | "downloading" | "error"`, `available`, `choiceIndex`, `notesScroll`, `progress`, `errorText`, `pendingStatus: "none" | "downloading" | "ready"`, `lastCheckError`, plus the install context. No behaviour yet; export the `UpdateState` interface. Call the hook in src/App.tsx and pass `updateOpen: phase is not "idle" and not "checking"` to `resolveActiveOverlay`
- [X] T016 Run `bun run typecheck && bun run check && bun run test`; all green, same pre-existing counts as T001 plus the new tests

**Checkpoint**: The app builds with a version and a release flag, stores the setting and the record, knows its install kind. No visible change yet.

---

## Phase 3: User Story 1 - Learn about a new version and update right away (Priority: P1) 🎯 MVP

**Goal**: Startup check finds a newer release, the overlay offers it, "Update now" downloads with progress, verifies, swaps the file, restarts as the new version.

**Independent Test**: Quickstart V1 (rig: old build, fake release source, choose `Update now`, app returns as the new version, executable bit set, `.old` present).

### Tests for User Story 1

- [X] T017 [P] [US1] Write failing tests in src/update/release.test.ts for `checkForUpdate({ fetch, installedVersion, assetName, sourceBase })` against a stubbed `fetch` (contracts/release-and-storage.md S1, S2): requests exactly `<api base>/repos/radekBednarik/pairwise-tui/releases/latest` with headers `Accept: application/vnd.github+json` and `User-Agent: pairwise-tui` and nothing identifying; higher `tag_name` with the asset and `SHA256SUMS.txt` listed gives an `AvailableUpdate` with `sizeBytes` from the asset; returns `null` when the tag does not match `^v\d+\.\d+\.\d+$`, is equal or lower, `draft` or `prerelease` is true, the asset is missing, or `SHA256SUMS.txt` is missing; `html_url` outside `https://github.com/radekBednarik/pairwise-tui/releases/` is replaced by the fixed releases URL; `browser_download_url` is never read (give it a hostile value and assert it appears nowhere in the result); non-200, invalid JSON, a body over 1 MB and a 10 s timeout each reject with a short reason. For `sanitizeNotes`: strips every control character except `\n` and `\t` (include `\x1b[31m`, `\x07`, `\r`, C1 controls `\x9b`), truncates to 20 000 characters, non-string gives empty string
- [X] T018 [P] [US1] Write failing tests in src/update/download.test.ts using a local `Bun.serve` and a temp dir: `fetchChecksum({ tag, assetName })` requests `<download base>/<tag>/SHA256SUMS.txt`, parses `sha256sum` lines (`<64 lowercase hex><two spaces><name>`), returns the hash for the asset, returns `null` when the line is absent or malformed, rejects a body over 64 KB; `downloadArtifact({ tag, assetName, sizeBytes, expectedSha256, targetPath, signal, onProgress })` writes `<target>.part` with mode `0o600`, calls `onProgress(received, total)`, on a matching hash renames to `<target>.new` and resolves with the hash; on mismatch deletes `.part`, leaves no `.new` and rejects with kind `"checksum-mismatch"`; aborts and deletes `.part` when more than `sizeBytes` arrive; abort through `signal` deletes `.part` and rejects with kind `"cancelled"`; a non-200 or a redirect to a non-`https` URL rejects (with the `https` rule relaxed only for the injected override base); 30 s without data rejects (use an injectable stall timeout)
- [X] T019 [P] [US1] Write failing tests in src/update/install.test.ts in a temp dir with fake files: `acquireLock(target)` creates `<target>.update.lock` with exclusive-create containing pid and timestamp, a second call fails while the recorded pid is alive **even when the lock is older than 1 h**, a lock whose pid is dead is replaced, a lock with unreadable content is replaced only when older than 1 h, `releaseLock` removes it (research R11); `installUpdate({ target, expectedSha256, identity, platform })` re-hashes `<target>.new` and refuses on difference, refuses when `fileIdentity(target)` differs from `identity`. **Linux and appimage path** (research R6): sets mode `0o755` on the new file, removes an existing `.old`, hard-links target to `.old` (falls back to copy when the injected `link` fails), then performs exactly one `rename(.new, target)`; assert through an injected `rename` spy that target is never renamed away, and that when this rename fails target still holds the complete old content. **Windows path** (select by the `platform` parameter so it runs on Linux too): deletes an existing `.old`, renames target to `.old`, renames `.new` to target, and when the second rename fails renames `.old` back. For both paths afterwards: target has the new content (mode `0o755` on linux and appimage), `.old` has the old content, no `.new` remains; `cleanupLeftovers({ target, record })` removes `.part` always, removes `.new` unless `record.pending` has a `sha256` and matching `targetPath`, removes a stale lock, never touches `.old`
- [X] T020 [P] [US1] Write failing tests in src/update/restart.test.ts with injected `execve`, `spawn` and `print`: on linux calls `execve(target, argv, env)` once; for appimage the env passed has no `APPIMAGE`, `APPDIR`, `ARGV0`; on windows spawns target with inherited stdio and resolves with the child's exit code (or, if the T002 note says fallback, prints the message); when `execve` or `spawn` throws, prints exactly `Updated to X.Y.Z. Please start pairwise-tui again.` and resolves with exit code 0
- [X] T021 [P] [US1] Write failing tests in src/hooks/keyboard/modalHandlers.test.ts for `handleUpdateKeys` in phase `offer` (contract U4): `left`/`right` and `tab` move `choiceIndex` across four choices with wrap; initial index is 2 (`Not now`); `up`/`down`/`pageup`/`pagedown` change `notesScroll` and never go below 0; `return` calls the action of the highlighted choice; `escape` calls `notNow`; every key returns `true` so global shortcuts stay inactive. Phase `downloading` (U7): `escape` calls `cancelDownload` unless `progress.stage` is `"installing"`. Phase `error` (U8): `return` and `escape` call `closeError`
- [X] T022 [P] [US1] Write failing tests in src/hooks/useUpdateState.test.tsx (render the hook through `renderTest` with injected update functions, as `useModelTabState.test.tsx` does): with `autoUpdate` on and `lastCheckAt` null, `runStartupCheck` calls the check once, stores `lastCheckAt` and `available`, and sets phase `offer`; with availability `"source-run"` or `"unsupported-platform"` the check is never called; a check that rejects leaves phase `idle`, sets `lastCheckError` and adds one message-log entry without a status popup (FR-009); `updateNow` with no unsaved work acquires the lock, saves `pending { mode: "now", sha256: null }`, fetches the checksum, downloads, saves the verified `sha256` into `pending`, installs, clears `pending`, saves `installedFrom` and calls restart (data-model PendingUpdate lifecycle, FR-022), with phase `downloading` and stages `downloading` → `verifying` → `installing`; a `null` checksum gives phase `error` with the "no checksum" text and no download; a `"checksum-mismatch"` gives phase `error` with the verification text; `cancelDownload` aborts and returns to `offer`; a failed lock gives phase `error` naming another copy
- [X] T023 [P] [US1] Write a failing UI test in src/App.test.tsx: with an injected update service that reports an available update, the overlay appears after startup showing `Update available`, `Installed:`, `New:`, `Download size:`, the notes, and the four choices in order with `Not now` highlighted; while a text field is being typed in, the overlay does not appear until the field is left (FR-014); `q` while the overlay is open does not quit; with an injected check that never resolves, the first frame is rendered and a key press (switching to tab 2) is handled while the check is still pending (SC-002)

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement src/update/release.ts (`checkForUpdate`, `sanitizeNotes`, source base constants with the build-time `__UPDATE_SOURCE_OVERRIDE__` fallback). Make T017 pass
- [X] T025 [P] [US1] Implement src/update/download.ts (`fetchChecksum`, `downloadArtifact` streaming through `Bun.CryptoHasher("sha256")`). Make T018 pass
- [X] T026 [P] [US1] Implement src/update/install.ts (`acquireLock`, `releaseLock`, `installUpdate`, `cleanupLeftovers`). Two install paths per research R6: atomic rename-over with a hard-link (or copy) backup on linux and appimage, two renames on win32. On win32 delete an existing `.old` first and report a clear reason if it is locked. Lock staleness by pid liveness (`process.kill(pid, 0)`), by age only when liveness is unknown. Make T019 pass
- [X] T027 [P] [US1] Implement src/update/restart.ts (`restartInto`). Make T020 pass
- [X] T028 [US1] Implement `handleUpdateKeys` in src/hooks/keyboard/modalHandlers.ts and route to it from src/hooks/useAppKeyboard.ts when `overlayKind === "update"`. Make T021 pass
- [X] T029 [US1] Fill in src/hooks/useUpdateState.ts: `runStartupCheck`, `updateNow` (including the `pending` lifecycle for mode `"now"`), `cancelDownload` (clears `pending`), `notNow` (closes, keeps `available`), `closeError`, with update functions injectable through an optional parameter that defaults to the real modules. Restart is requested through a callback so App can destroy the renderer first. Make T022 pass
- [X] T030 [US1] Create src/components/UpdateOverlay.tsx with phases `offer`, `downloading` and `error` (contracts U4, U7, U8): themed like `ClearConfirmOverlay`, notes in a `scrollbox` as plain text, size shown in MB with one decimal, progress as percentage and bytes
- [X] T031 [US1] Wire into src/App.tsx: render `UpdateOverlay` for `overlayKind === "update"`; run `runStartupCheck` once after settings have loaded and only when `autoUpdate` is true; open the offer through `useDeferredScreenChange` so it waits for no overlay and no active text field; provide the restart callback (`renderer.destroy()` then `restartInto`). Make T023 pass
- [X] T032 [US1] Show the one-time notice (contract U9, FR-026): after settings load, if the record's `installedFrom` is set, call `showStatus("Updated to X.Y.Z (previous version kept as <basename of target>.old)")`, then clear `installedFrom` and save. Add a test for it in src/App.test.tsx first
- [X] T033 [US1] Run `bun run typecheck && bun run check && bun run test`; all green

**Checkpoint**: Quickstart V1 works on Linux. This is the MVP.

---

## Phase 4: User Story 7 - A failed update never breaks the app (Priority: P1)

**Goal**: Every failure path leaves a startable app, a clear message, and no stray files.

**Independent Test**: Quickstart V5, V6, V14 (mismatch, missing checksum, offline).

- [X] T034 [P] [US7] Write failing tests in src/update/startup.test.ts for `runStartupTasks({ context, record })` cleanup behaviour: removes `.part`; removes an orphan `.new`; removes a stale lock; keeps `.old`; drops `record.available` when it is not newer than the installed version; drops `record.pending` when its `targetPath` differs from the context target or `.new` is missing; does nothing and never throws for availability `"source-run"`, `"unsupported-platform"` or `"read-only"`; any internal error is swallowed and returned as a reason string (the app must still start)
- [X] T035 [US7] Implement src/update/startup.ts with the cleanup half of `runStartupTasks` (the pending-install half comes in T045). Call it from src/index.tsx before `createCliRenderer`, wrapped so a failure cannot prevent startup. Make T034 pass
- [X] T036 [P] [US7] Add failing failure-injection tests to src/update/install.test.ts and src/update/download.test.ts covering SC-003: storage full during download (injected write error) leaves no `.part`; `.new` altered after verification is refused at install with target untouched; target moved before install is refused; on the linux path the single rename failing leaves target untouched, and a failing hard-link falls back to copy without touching target; on the win32 path the first rename failing leaves target untouched and a locked `.old` is refused with target untouched; a simulated kill on the linux path after the backup step and before the rename (stop the function there through an injected hook) leaves target complete and startable (research R6 no-gap guarantee). After each case assert target still holds the complete old content
- [X] T037 [US7] Close any gaps T036 exposes in src/update/install.ts and src/update/download.ts. Make T036 pass
- [X] T038 [P] [US7] Add failing tests to src/hooks/useUpdateState.test.tsx: every rejection kind maps to the exact contract U8 text; after an error the lock is released, `record.pending` is null, phase `error` then `closeError` returns to `idle` with `available` kept for the next startup; an automatic check that fails is silent apart from the message log (FR-009)
- [X] T039 [US7] Implement the error mapping and cleanup-on-failure in src/hooks/useUpdateState.ts, and make sure `UpdateOverlay.tsx` phase `error` shows the release page address for the missing-checksum case. Make T038 pass

**Checkpoint**: V5, V6 and V14 pass; the app starts after each.

---

## Phase 5: User Story 2 - Update without interrupting work (Priority: P2)

**Goal**: "Update on exit" downloads in the background and installs on quit, or at next startup if the exit was abnormal.

**Independent Test**: Quickstart V2 and V3.

- [X] T040 [P] [US2] Add failing tests to src/hooks/useUpdateState.test.tsx: `updateOnExit` closes the overlay (phase `idle`), saves `pending { mode: "onExit", sha256: null }`, sets `pendingStatus: "downloading"`, then on success saves the hash and sets `pendingStatus: "ready"`; a background failure sets `pendingStatus: "none"`, clears `pending`, shows one status message and no overlay; `finishOnQuit()` with status `ready` installs, sets `installedFrom` and resolves `true`; with status `downloading` it aborts the download, removes `.part`, installs nothing and resolves `false` without waiting (FR-021); a second check that finds a still newer version while pending discards the pending files and offers the newer one
- [X] T041 [US2] Implement `updateOnExit` and `finishOnQuit` in src/hooks/useUpdateState.ts. Make T040 pass
- [X] T042 [P] [US2] Write a failing test in src/App.test.tsx: pressing `q` with a ready pending update calls `finishOnQuit` before the renderer is destroyed; `Ctrl+C` does the same; pressing `q` or `Ctrl+C` with nothing pending behaves exactly as today
- [X] T043 [US2] In src/App.tsx introduce a single `quit()` used by the `destroy` action passed to the keyboard hook: `await finishOnQuit()` then `renderer.destroy()`, with the install wrapped so an error still lets the app exit. Route the `Ctrl+C` handler in src/hooks/useAppKeyboard.ts (the `ctrl && name === "c"` branch) through the same `quit()`. Make T042 pass and confirm with a search that no other code path calls `renderer.destroy()` for quitting
- [X] T044 [P] [US2] Add failing tests to src/update/startup.test.ts for the pending-install half: a record with `pending.sha256` set, matching `targetPath` and a `.new` file with that hash is installed, `installedFrom` is saved, `pending` cleared, and the result asks for a restart; a hash difference removes `.new`, clears `pending` and asks for no restart; a failed lock leaves everything for a later start
- [X] T045 [US2] Implement the pending-install half of `runStartupTasks` in src/update/startup.ts and, in src/index.tsx, call `restartInto` when it asks for a restart (no renderer exists yet). Make T044 pass
- [X] T046 [US2] Run `bun run typecheck && bun run check && bun run test`; all green

**Checkpoint**: V2 and V3 pass on Linux.

---

## Phase 6: User Story 3 - Decline or skip a version (Priority: P2)

**Goal**: "Not now" re-offers at next startup without a network call; "Skip this version" silences one version.

**Independent Test**: Quickstart V4.

- [X] T047 [P] [US3] Add failing tests to src/hooks/useUpdateState.test.tsx: with `lastCheckAt` younger than 24 h and a cached `available`, `runStartupCheck` makes no request and still opens the offer (FR-006); with `lastCheckAt` older than 24 h it requests once and saves `lastAttemptAt`; a failed check saves `lastAttemptAt` but not `lastCheckAt`, and the next startup within 1 h makes no request while one after 1 h does (FR-006, SC-008); when a due check fails and a cached non-skipped `available` exists, the cached version is still offered and the failure goes to the message log only; with `lastCheckAt` younger than 24 h and no cached `available` it does nothing; `skipVersion` saves `skippedVersion`, closes the overlay and downloads nothing; a cached or fresh `available` equal to `skippedVersion` opens nothing; a version higher than `skippedVersion` is offered (FR-013); `notNow` and `skipVersion` create no file beside the target
- [X] T048 [US3] Implement the 24 h success throttle and 1 h attempt throttle (injectable `now`), the cache re-offer (also after a failed check) and `skipVersion` in src/hooks/useUpdateState.ts. Make T047 pass

**Checkpoint**: V4 passes.

---

## Phase 7: User Story 4 - Control updates from the Options tab (Priority: P2)

**Goal**: Version, toggle, manual check and state row in the Options tab.

**Independent Test**: Quickstart V12 and V13.

- [X] T049 [P] [US4] Write failing tests in src/hooks/keyboard/optionsTabHandlers.test.ts and src/constants.test.ts: `OPTION_FIELDS` order ends `..., "aiModel", "autoUpdate", "checkUpdates", "none"`; `nextOptionField("aiModel")` is `"autoUpdate"`; `return` on `autoUpdate` toggles the setting; `return` on `checkUpdates` calls `checkNow`; both do nothing when the updater is unavailable (source run or unsupported platform)
- [X] T050 [US4] Add `"autoUpdate"` and `"checkUpdates"` to `ActiveOptionField` and `OPTION_FIELDS` in src/constants.ts and handle them in src/hooks/keyboard/optionsTabHandlers.ts. Make T049 pass
- [X] T051 [P] [US4] Add failing tests to src/hooks/useUpdateState.test.tsx: `checkNow` ignores the 24 h and 1 h limits and `skippedVersion`; with `pendingStatus` `downloading` or `ready` it makes no request, opens no overlay and shows the matching status text from contract U3; a skipped version offered by `checkNow` and answered with `notNow` keeps `skippedVersion`, while `updateNow` or `updateOnExit` clears it; up to date gives status `You are up to date (X.Y.Z)`; failure gives status `Update check failed: <reason>`; found opens the overlay; `checkNow` works with `autoUpdate` false; with `autoUpdate` false `runStartupCheck` makes zero requests (FR-007, SC-005); turning `autoUpdate` off while `pendingStatus` is `downloading` or `ready` aborts, removes `.part` and `.new`, clears `pending` (FR-033)
- [X] T052 [US4] Implement `checkNow` and the cancel-on-disable effect in src/hooks/useUpdateState.ts; add `autoUpdate` state to src/App.tsx (loaded, saved with the other settings, passed to the hook). Make T051 pass
- [X] T053 [P] [US4] Write a failing UI test in src/App.test.tsx: the Options tab shows an `Updates` section after `AI Settings` with `Version` and the installed version, `Automatic updates` showing `ON` by default, `Check for updates now`, and the state row texts from contract U2 for: pending downloading, pending ready, run from source, last check failed
- [X] T054 [US4] Add the Updates section to src/components/OptionsTab.tsx (contract U1, U2), dimmed when unavailable, following the existing toggle row markup. Make T053 pass

**Checkpoint**: V12 and V13 pass.

---

## Phase 8: User Story 5 - Unsaved work is protected (Priority: P2)

**Goal**: "Update now" warns before discarding unsaved work.

**Independent Test**: Quickstart V11.

- [X] T055 [P] [US5] Write failing tests in src/App.test.tsx (or a new src/hooks/useUnsavedWork.test.tsx if extracted): no unsaved work at startup; adding a parameter makes it unsaved; saving the model or opening a model clears it; clearing the model resets it; generating results makes it unsaved until results are saved (research R12)
- [X] T056 [US5] Implement the unsaved-work check in src/App.tsx (or src/hooks/useUnsavedWork.ts): keep the serialized model text (`serialize` from src/pict/model.ts) from the last save, open or clear in a ref and compare with the current one; keep a `resultsUnsaved` flag set by generate and cleared by save results. Make T055 pass
- [X] T057 [P] [US5] Add failing tests to src/hooks/useUpdateState.test.tsx and src/hooks/keyboard/modalHandlers.test.ts (contract U6): `updateNow` with unsaved work sets phase `unsavedWarning` and starts nothing; choices `Go back` (initial, also `escape`) returns to `offer`; `Save model first` calls the save callback and, only if it resolves successfully, proceeds as update now, otherwise stays with the save error shown; `Update on exit instead` behaves as `updateOnExit`; with no unsaved work no warning appears
- [X] T058 [US5] Implement phase `unsavedWarning` in src/hooks/useUpdateState.ts, src/hooks/keyboard/modalHandlers.ts and src/components/UpdateOverlay.tsx. `handleSaveModel` in src/App.tsx must report success or failure to the caller; change its return type to `Promise<boolean>` without altering what it does. Make T057 pass

**Checkpoint**: V11 passes.

---

## Phase 9: User Story 6 - Installation the app cannot modify (Priority: P3)

**Goal**: A read-only install gets a notice with the download address, never a download or an elevation prompt.

**Independent Test**: Quickstart V7.

- [X] T059 [P] [US6] Add failing tests to src/hooks/useUpdateState.test.tsx, src/hooks/keyboard/modalHandlers.test.ts and src/App.test.tsx (contract U5): with availability `"read-only"` a found update opens phase `notice`; the overlay shows the versions, notes, `Download: <pageUrl>` and `This installation cannot update itself (no write permission).`; choices are `Close` (initial, also `escape`) and `Skip this version`; `updateNow` and `updateOnExit` are unreachable and, if called, do nothing; the Options state row shows `Self-update unavailable: no write permission for the app's folder`; nothing is written beside the target; no process is spawned in this flow (assert the injected `spawn` is never called, FR-030)
- [X] T060 [US6] Implement phase `notice` in src/hooks/useUpdateState.ts, src/hooks/keyboard/modalHandlers.ts and src/components/UpdateOverlay.tsx, and the state row in src/components/OptionsTab.tsx. Make T059 pass

**Checkpoint**: V7 passes. All stories done.

---

## Phase 10: Release side, documentation, review

**Purpose**: Things that span stories or live outside `src/`.

- [X] T061 [P] Update .github/workflows/release.yml (contract S3): add a first job step that fails when `${GITHUB_REF_NAME}` is not `v` + the `version` in package.json, and when `UPDATE_SOURCE_OVERRIDE` is set; in the `release` job, after the downloads, run `cd dist && sha256sum pairwise-tui pairwise-tui.exe Pairwise-TUI-x86_64.AppImage > SHA256SUMS.txt`; add `dist/SHA256SUMS.txt` to `files`. Make every job that builds depend on the guard
- [X] T062 [P] Create scripts/dev-fake-release.ts (quickstart section 2): a `Bun.serve` on port 8787 serving a `releases/latest` JSON built from the files in `dist/` and the package.json version, `SHA256SUMS.txt` computed on the fly, and the artifacts; log every request line. Header comment explains the rig. Not referenced by any build
- [X] T063 [P] Update README.md: a section on automatic updates stating the default-on startup check, that only GitHub release information is read and nothing is sent, how to turn it off, the four choices, the `.old` backup and the restore steps from contract S6, and that read-only installs only get a notice (FR-028, FR-036)
- [X] T064 [P] Update the in-app docs in src/docs/pict-docs.ts with the Updates section of the Options tab and adjust src/docs/pict-docs.test.ts first if it asserts chapter contents
- [X] T065 [P] Update .claude/memory/project_release_process.md: the version is bumped in `package.json` (not `scripts/build-windows.ts`), the tag must match it or the workflow fails, releases now include `SHA256SUMS.txt`, and asset names must not change. Update the index line in .claude/memory/MEMORY.md and the "PICT binaries"/conventions text in CLAUDE.md only if they became inaccurate
- [X] T066 Run `bun run typecheck && bun run check && bun run test`; all green. Run `bun run build:dist` and confirm both artifacts build
- [ ] T067 Code review pass over the whole diff (project workflow). Report findings to the user and let them pick what to fix
- [ ] T068 Security review pass (plan.md Constitution Check): fixed download origin and no use of `browser_download_url`; checksum enforced and re-checked before install; staging file modes; lock handling; AppImage target guard; sanitizing of release notes; no shell invocation; no elevation of any kind (FR-030: no `sudo`, `pkexec`, `runas`, UAC manifest or elevation API, and the only spawn is the app's own file on Windows restart); no runtime way to change the release source; nothing identifying in requests. Report findings to the user
- [X] T069 Manual validation on Linux with the rig: quickstart V1 to V7, V10 to V15. Record results in specs/002-auto-update/quickstart.md
- [ ] T070 Manual validation of the AppImage (V9) and Windows (V8). If Windows input after restart is unreliable, switch Windows to the fallback message in src/update/restart.ts, update its test and research R8. These need the user's machines; ask the user to run them if they cannot be run here

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** → **Phase 2** → user stories. Phase 10 after the stories it documents.
- **US1 (Phase 3)**: needs Phase 2 only. Everything else builds on its modules.
- **US7 (Phase 4)**: needs US1 (hardens its modules).
- **US2 (Phase 5)**: needs US1; T044/T045 extend the file created in US7's T035.
- **US3 (Phase 6)**: needs US1.
- **US4 (Phase 7)**: needs US1; the pending state row and cancel-on-disable need US2.
- **US5 (Phase 8)**: needs US1; the "Update on exit instead" choice needs US2.
- **US6 (Phase 9)**: needs US1 and the state row from US4.

Recommended order: 1, 2, 3 (US1), 4 (US7), 5 (US2), 6 (US3), 7 (US4), 8 (US5), 9 (US6), 10.

### Within each story

Tests first and seen failing, then pure modules, then the hook, then keyboard and component, then App wiring.

### Parallel opportunities

- Phase 2: T004, T007, T009, T011, T013 (separate test files), then their implementations touch separate files.
- US1 tests T017 to T023 are all in different files; implementations T024 to T027 are four independent modules.
- Phase 10: T061 to T065 touch unrelated files.
- Tasks that edit src/hooks/useUpdateState.ts, src/App.tsx, src/components/UpdateOverlay.tsx or modalHandlers.ts are **not** parallel with each other across stories.

## Parallel Example: User Story 1

```text
# Four independent modules, tests then code:
T017 + T024  src/update/release.ts
T018 + T025  src/update/download.ts
T019 + T026  src/update/install.ts
T020 + T027  src/update/restart.ts
```

## Implementation Strategy

### MVP first

Phases 1 to 3, then quickstart V1. That alone gives a working self-update on Linux.

Do **not** release the MVP alone: without Phase 4 the failure paths are unproven, and without T061 no release carries checksums, so no update could ever be installed.

### Incremental delivery

1. US1 + US7: safe "Update now".
2. US2: on exit and next startup.
3. US3 + US4: user control.
4. US5 + US6: protection and read-only installs.
5. Phase 10, then one release. The release after it is the first that existing users reach through auto-update.

## Notes

- Commit after each green group of tasks; hyphen-only commit messages.
- The memory file change (T065) is committed together with the release workflow change (T061), since it is wrong before and right after.
- If any task would change existing behaviour outside this spec, stop and ask.
