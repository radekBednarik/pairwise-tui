# Quickstart: Validating Automatic Update

Contracts: [update-interface.md](./contracts/update-interface.md), [release-and-storage.md](./contracts/release-and-storage.md). Data: [data-model.md](./data-model.md).

## 1. Automated gates

```sh
bun run check
bun run typecheck
bun run test
```

All three must pass. The test suite never contacts GitHub: updater tests use temporary directories and a local fake release source (research R14).

## 2. Local end-to-end rig (Linux, no real release needed)

The release source address is fixed at **build time**. A rig build bakes in a local address through the build scripts' `UPDATE_SOURCE_OVERRIDE` variable; builds without it (all CI releases) contain only the GitHub addresses, and no runtime setting or environment variable can change them.

1. Build two versions:
   ```sh
   # set "version": "9.9.8" in package.json
   UPDATE_SOURCE_OVERRIDE=http://localhost:8787 bun run build:dist:linux
   mkdir -p /tmp/pt-old && cp dist/pairwise-tui /tmp/pt-old/
   # set "version": "9.9.9"
   UPDATE_SOURCE_OVERRIDE=http://localhost:8787 bun run build:dist:linux
   ```
2. Serve `dist/pairwise-tui`, a matching `SHA256SUMS.txt` and a `releases/latest` JSON using the fake release source script delivered with the feature (`bun scripts/dev-fake-release.ts`, port 8787).
3. Start `/tmp/pt-old/pairwise-tui`.

The `https`-only rule is relaxed for the baked-in override address alone.

Restore `package.json` afterwards.

## 3. Manual scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| V1 | Update now | Rig, start old build, choose `Update now` | Progress, restart in same terminal, Options shows `9.9.9`, status `Updated to 9.9.9 ...`, `pairwise-tui.old` exists, new file is executable |
| V2 | Update on exit | Choose `Update on exit`, wait for `will be installed on exit`, press `q`, start again | Second start is `9.9.9` |
| V3 | Abnormal end | Choose `Update on exit`, wait until verified, `kill -9` the process, start again | New version starts directly with the notice, no old interface flash |
| V4 | Not now / Skip | `Not now`, restart: offer again without network (stop the fake server). `Skip this version`, restart: no offer. Manual check: offer returns | As described |
| V5 | Checksum mismatch | Alter one byte of the served artifact | Error phase, old version runs, no `.new` or `.part` left |
| V6 | Missing checksum | Remove the asset line from `SHA256SUMS.txt` | `this release has no checksum`, nothing installed |
| V7 | Read-only install | `chmod a-w /tmp/pt-old` | Notice-only overlay with address; Options state row explains |
| V8 | Windows | Repeat V1, V2, V3 with the `.exe` on Windows | Same results. **Watch keyboard input after restart** (research R8, unverified). If input is unreliable, switch Windows to the "please start again" fallback |
| V9 | AppImage | Repeat V1 and V2 with the AppImage | The `.AppImage` file is replaced, `.AppImage.old` exists, still executable |
| V10 | AppImage guard | Start the plain Linux build with `APPIMAGE=/tmp/x.AppImage` exported | Updater targets the plain executable, never `/tmp/x.AppImage` |
| V11 | Unsaved work | Add a parameter, manual check, `Update now` | Warning with three choices; each behaves per contract U6 |
| V12 | Auto-update off | Toggle off, restart with fake server logging requests | Zero requests; manual check makes one |
| V13 | Source run | `bun run start` | Updates section dimmed, `Updates unavailable when running from source`, zero requests |
| V14 | Offline | Stop the server, clear `update.json`, start | No overlay, no error, one entry in the message log |
| V15 | Typing | Start, immediately start typing a parameter name while the check completes | Overlay waits until the field is left |

### Results, 2026-11-11 (Linux x64, WSL2, plain executable)

Run with two real compiled builds (9.9.8 and 9.9.9) against `scripts/dev-fake-release.ts`, driven through a pseudo-terminal script. "UI test" means the scenario is covered by the headless tests in `src/App.test.tsx` instead of a real terminal run.

| # | Result | Notes |
|---|--------|-------|
| V1 | PASS | Restart keeps the same process id (execve); `.old` is the previous build; mode 0755 |
| V2 | PASS | |
| V3 | PASS | No offer overlay from the old version is drawn before the new one starts |
| V4 | PASS | Re-offer served from cache with the fake server stopped |
| V5 | PASS | Only the app file remains beside the app |
| V6 | PASS | The artifact is never requested |
| V7 | PASS | No download request made |
| V8 | NOT RUN | Needs a real Windows terminal. File swap and waited child were verified by the T002 spike; keyboard input after restart is still unverified |
| V9 | NOT RUN | Needs an AppImage build and FUSE |
| V10 | PASS | Decoy "terminal emulator" AppImage untouched; the plain executable was updated |
| V11 | UI test | |
| V12 | PASS | Zero requests in 4 s with the setting off; one after the manual check |
| V13 | UI test | |
| V14 | PASS | `lastAttemptAt` recorded, `lastCheckAt` not |
| V15 | UI test | |

One earlier run of the whole set had V3 and V4 fail; two complete reruns passed. In the failed run the outcome matched an arrow key not reaching the app (Enter then lands on the default "Not now"). The cause was not pinned down; the pseudo-terminal driver's key timing is the suspect, not confirmed.

## 4. Release workflow check

On a throwaway tag in a fork, or by reading the run of the first real release:

- A tag that differs from `package.json` version fails early.
- The release lists `SHA256SUMS.txt` with three lines, and `sha256sum -c SHA256SUMS.txt` passes on the downloaded artifacts.

## 5. Documentation check

- README states the default-on check, what is contacted, how to turn it off, and how to restore `.old`.
- In-app docs mention the Updates section.
- `.claude/memory/project_release_process.md` names `package.json` as the place to bump the version.
