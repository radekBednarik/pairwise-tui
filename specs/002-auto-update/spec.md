# Feature Specification: Automatic Application Update

**Feature Branch**: `002-auto-update`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "As a user, I want to be able to enable in the settings the automatic update. The application will be checking github releases periodically and if new version for given OS is released, it will download it and replace existing binary with the new one. On linux, the chmod +x must be handled, otherwise user will not be able to run the new version of the app. Flow: user enables it in the settings, by default on. Application checks for updates on startup. If a new update is found, the user is notified by an overlay and decides whether to update now or later. If now, the app is replaced by the new version and restarted. If later, the replacement happens on application exit."

## Clarifications

### Session 2026-11-11

- Q: Which release artifacts does auto-update cover? → A: All three: the plain Linux executable, the Windows executable and the Linux AppImage. Each updates to its own artifact type.
- Q: Download before or after asking the user? → A: Ask first. Nothing is downloaded until the user agrees.
- Q: Which choices does the offer give? → A: Update now, Update on exit, Not now, Skip this version.
- Q: What does "Not now" do on later startups? → A: The offer is shown again on the next startup. "Skip this version" silences that one version until a newer one is released.
- Q: How is a download verified? → A: Each release publishes checksums. The app refuses to install on a mismatch or when the checksum is missing.
- Q: When does the app check? → A: In the background at startup, at most once per 24 hours. No checks while running.
- Q: Is there a manual check? → A: Yes, an action in the Options tab that works even when auto-update is off.
- Q: How does "Update now" treat unsaved work? → A: It warns and asks for confirmation. Nothing is carried across the restart.
- Q: What if the app cannot overwrite itself? → A: Detected before offering. The overlay only announces the version and the download page address. The app never asks for administrator rights.
- Q: What if the app ends abnormally before an agreed "Update on exit"? → A: The update is finished on the next startup.
- Q: Is the previous version kept? → A: One previous copy is kept for manual restore. No automatic rollback.
- Q: What does the overlay show? → A: Current version, new version, download size and the release notes text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learn about a new version and update right away (Priority: P1)

A tester starts the app. In the background the app finds that a newer release exists for their platform. An overlay appears showing the installed version, the new version, the download size and the release notes. The tester picks "Update now". The app downloads the new version showing progress, verifies it, replaces itself, and restarts as the new version in the same terminal.

**Why this priority**: This is the core of the request. Today users only learn about a release by visiting the project page, and must download and replace the file by hand, including restoring the executable permission on Linux.

**Independent Test**: Run an older build while a newer release is published, choose "Update now", and confirm the app comes back as the new version with no manual step.

**Acceptance Scenarios**:

1. **Given** auto-update is on and a newer release exists for the user's platform, **When** the app starts, **Then** the interface is usable immediately and an update overlay appears once the background check finishes.
2. **Given** the update overlay is shown, **When** the user reads it, **Then** it shows the installed version, the new version, the download size, the release notes text (scrollable when long) and the choices Update now, Update on exit, Not now and Skip this version.
3. **Given** the update overlay is shown, **When** the user has not yet chosen, **Then** nothing has been downloaded.
4. **Given** the user chooses "Update now" and has no unsaved work, **When** the download and verification succeed, **Then** the app replaces itself, restarts, and the Options tab shows the new version number.
5. **Given** the app has just been updated on Linux, **When** the user launches it again later, **Then** it starts without the user having to restore the executable permission.
6. **Given** the user chooses "Update now", **When** the download is running, **Then** progress is visible and the user can cancel, which leaves the installed version untouched.
7. **Given** the app is the AppImage, **When** an update is installed, **Then** the AppImage file the user launched is the one replaced, and it is replaced by the new AppImage.

---

### User Story 2 - Update without interrupting work (Priority: P2)

A tester in the middle of modelling sees the update overlay and picks "Update on exit". The overlay closes, the download runs in the background while they keep working, and when they quit the app replaces itself. The next launch is the new version.

**Why this priority**: The offer can arrive at an inconvenient moment. Without this path, users either lose focus or keep postponing updates.

**Independent Test**: Choose "Update on exit", keep working, quit normally, start the app again and confirm it is the new version.

**Acceptance Scenarios**:

1. **Given** the user chooses "Update on exit", **When** the overlay closes, **Then** the user can continue working and the download proceeds without blocking the interface.
2. **Given** the download has finished and was verified, **When** the user quits the app, **Then** the app replaces itself before ending and the next launch runs the new version.
3. **Given** an update is waiting for exit, **When** the user looks at the Options tab, **Then** it states that the new version will be installed on exit.
4. **Given** the user chose "Update on exit" and the verified download exists, **When** the app ends abnormally (terminal closed, process killed, crash), **Then** on the next startup the app installs the update before the interface appears and tells the user it now runs the new version.
5. **Given** the user chose "Update on exit", **When** the user quits before the download finished, **Then** the app exits without delay, the installed version is untouched, and the offer is made again on a later startup.

---

### User Story 3 - Decline or skip a version (Priority: P2)

A tester who does not want to update now picks "Not now" and is asked again on the next startup. A tester who does not want a particular version at all picks "Skip this version" and is not asked again until an even newer version is released.

**Why this priority**: With auto-update on by default, an offer that cannot be silenced would push users to turn the whole feature off.

**Independent Test**: Answer "Not now", restart and see the offer again. Answer "Skip this version", restart and see no offer. Publish a newer release and see the offer return.

**Acceptance Scenarios**:

1. **Given** the user chose "Not now", **When** the app starts again, **Then** the same version is offered again, regardless of the 24-hour check limit.
2. **Given** the user chose "Skip this version", **When** the app starts again and that version is still the newest, **Then** no overlay appears.
3. **Given** a version was skipped, **When** a newer version than the skipped one is released, **Then** the overlay appears for the newer version.
4. **Given** the user chose "Not now" or "Skip this version", **When** the overlay closes, **Then** nothing was downloaded.

---

### User Story 4 - Control updates from the Options tab (Priority: P2)

A tester opens the Options tab and finds an update section showing the installed version, an "Automatic updates" toggle (on by default) and a "Check for updates now" action. They turn the toggle off; from then on the app never contacts the release source on its own. Later they run the manual check and get either the update overlay or a message that they are up to date.

**Why this priority**: The request names the setting explicitly. Users on restricted networks or with pinned versions must be able to stop all automatic network activity.

**Independent Test**: Turn the toggle off, restart with a newer release available and confirm no check happens. Run the manual check and confirm the overlay appears.

**Acceptance Scenarios**:

1. **Given** a fresh installation or settings saved by an earlier version, **When** the app starts, **Then** automatic updates are on.
2. **Given** the user turns automatic updates off, **When** the app is restarted, **Then** the setting is still off and no update check is made at startup.
3. **Given** automatic updates are off, **When** the user runs "Check for updates now" and a newer version exists, **Then** the update overlay appears with the same choices as the automatic one.
4. **Given** the user runs "Check for updates now" and no newer version exists, **When** the check finishes, **Then** a message says the app is up to date.
5. **Given** a version was skipped earlier, **When** the user runs "Check for updates now", **Then** that version is offered anyway.
6. **Given** the manual check cannot reach the release source, **When** it fails, **Then** the user sees a message saying the check failed and why.

---

### User Story 5 - Unsaved work is protected (Priority: P2)

A tester with unsaved model changes picks "Update now". Before anything restarts, the app warns that restarting discards unsaved work and offers to go back, save the model first, or switch to "Update on exit".

**Why this priority**: The model exists only in the running session. A restart that silently discards it would make users distrust the update feature.

**Independent Test**: Edit a model without saving, trigger the offer, choose "Update now" and confirm the warning appears and each of its choices behaves as described.

**Acceptance Scenarios**:

1. **Given** the user has unsaved work, **When** they choose "Update now", **Then** a warning appears before any restart and offers Go back, Save model first and Update on exit instead.
2. **Given** the warning is shown, **When** the user chooses "Go back", **Then** the update overlay is shown again and nothing has changed.
3. **Given** the warning is shown, **When** the user chooses "Save model first" and the save succeeds, **Then** the update proceeds as "Update now".
4. **Given** the warning is shown, **When** the user chooses "Update on exit instead", **Then** the flow continues as in User Story 2.
5. **Given** the user has no unsaved work, **When** they choose "Update now", **Then** no warning appears.

---

### User Story 6 - Installation the app cannot modify (Priority: P3)

A tester whose app was installed by an administrator into a protected location starts the app while a newer release exists. The overlay announces the new version with its release notes and the address of the download page, but offers no download. The Options tab explains that self-update is unavailable for this installation.

**Why this priority**: Less common than a personal installation, but without it these users would get an offer that always fails.

**Independent Test**: Run the app from a location the current user cannot write to, with a newer release available, and confirm the overlay is notice-only.

**Acceptance Scenarios**:

1. **Given** the app cannot replace its own file, **When** a newer version is found, **Then** the overlay shows the versions, release notes and download page address, and offers only Close and Skip this version.
2. **Given** the app cannot replace its own file, **When** the user opens the Options tab, **Then** the update section says self-update is unavailable and why.
3. **Given** the app cannot replace its own file, **When** any update flow runs, **Then** the app never asks for administrator rights.

---

### User Story 7 - A failed update never breaks the app (Priority: P1)

A tester's download is interrupted, corrupted, or the release has no checksum. The app refuses to install, keeps the installed version working, and says what went wrong. If an installed update turns out to be bad, the tester restores the previous version from the single backup copy kept beside the app.

**Why this priority**: A self-replacing app that can leave the user with no working executable is worse than no auto-update at all.

**Independent Test**: Serve a download that does not match its published checksum and confirm the installed version is untouched and still starts.

**Acceptance Scenarios**:

1. **Given** a download does not match the published checksum, **When** verification runs, **Then** the update is not installed, the download is discarded, the installed version keeps working and the user is told verification failed.
2. **Given** a release has no published checksum for the user's artifact, **When** the user agrees to update, **Then** the update is refused with a message and the download page address.
3. **Given** the download is interrupted or storage runs out, **When** the failure occurs, **Then** the installed version is untouched and the offer is made again on a later startup.
4. **Given** the replacement step fails part-way, **When** the app is started again, **Then** the previously installed version still starts.
5. **Given** an update was installed, **When** the user looks beside the app, **Then** exactly one copy of the previous version exists, and following the documented steps restores it.
6. **Given** the startup check cannot reach the release source, **When** it fails, **Then** no overlay or error interrupts the user and the failure is recorded in the message log.

---

### Edge Cases

- **No release artifact for this platform**: a newer release exists but lacks the artifact matching the running one. Treated as "no update available"; no overlay.
- **Installed version is newer than, or equal to, the latest release**: no offer. The app never downgrades.
- **Pre-releases and drafts**: ignored. Only published stable releases are offered.
- **Run from source during development**: all update behaviour is inert and the Options tab says updates are unavailable in this mode.
- **Check limit reached at the release source**: handled like an unreachable source; the next attempt is on a later startup.
- **Overlay timing**: the update overlay must not appear on top of another open overlay or while the user is typing in a text field; it waits until the interface is idle.
- **Automatic updates turned off while an "Update on exit" is pending**: the pending update is cancelled and its download discarded.
- **Several running copies of the app**: only one copy installs a given update; the others keep running the old version until restarted and do not fail.
- **A newer version is released while an older download is pending**: the pending download is discarded and the newer version is offered.
- **App file moved or renamed since launch**: the update is refused with a message rather than writing to the old location.
- **Automatic restart not possible**: after replacing itself, the app exits cleanly and tells the user to start it again.
- **Leftover files**: partial downloads and files from an interrupted update are cleaned up on the next startup, except the one backup copy.
- **Abnormal end before the download finished**: nothing is installed on next startup; the version is offered again.

## Requirements *(mandatory)*

### Functional Requirements

**Setting and visibility**

- **FR-001**: The Options tab MUST provide an "Automatic updates" setting that is on by default, including for users whose saved settings predate this feature, and that persists across restarts.
- **FR-002**: The Options tab MUST show the installed version of the app.
- **FR-003**: The Options tab MUST provide a "Check for updates now" action that works regardless of the automatic setting, ignores the check limit in FR-006 and ignores any skipped version.
- **FR-004**: The Options tab MUST show the current update state when one applies: update pending for exit, self-update unavailable (with reason), or last check failed.

**Checking**

- **FR-005**: When automatic updates are on, the app MUST check for a newer release at startup, in the background, without delaying or blocking the interface.
- **FR-006**: The automatic check MUST contact the release source at most once per 24 hours, counted from the last successful check. A version that was found and answered with "Not now" MUST still be offered on the next startup.
- **FR-007**: When automatic updates are off, the app MUST NOT contact the release source unless the user runs the manual check.
- **FR-008**: The app MUST treat a release as an update only if it is a published stable release, its version is higher than the installed version, and it contains the artifact matching the running one (plain Linux executable, Windows executable, or Linux AppImage).
- **FR-009**: A failed automatic check MUST NOT interrupt the user; it MUST be recorded in the message log. A failed manual check MUST be reported to the user with the reason.

**Offer**

- **FR-010**: When an update is found, the app MUST show an overlay with the installed version, the new version, the download size and the release notes text, scrollable when it does not fit.
- **FR-011**: The overlay MUST offer: Update now, Update on exit, Not now, Skip this version.
- **FR-012**: The app MUST NOT download any part of an update before the user chooses "Update now" or "Update on exit".
- **FR-013**: "Skip this version" MUST suppress automatic offers of that version, persistently, until a higher version is released.
- **FR-014**: The overlay MUST appear only when no other overlay is open and no text field is being edited.

**Download and verification**

- **FR-015**: Updates MUST be downloaded only from this project's official releases, over an encrypted connection.
- **FR-016**: Each release MUST publish a checksum for every artifact, and the app MUST verify the downloaded file against it before installing.
- **FR-017**: The app MUST refuse to install, discard the download and inform the user when the checksum does not match or is not published.
- **FR-018**: For "Update now", download progress MUST be visible and the user MUST be able to cancel. For "Update on exit", the download MUST run without blocking the interface.

**Installing**

- **FR-019**: "Update now" MUST, after successful verification, replace the installed app with the new version and restart it in the same terminal.
- **FR-020**: Before "Update now" restarts the app while unsaved work exists, the app MUST warn the user and offer: Go back, Save model first, Update on exit instead.
- **FR-021**: "Update on exit" MUST replace the installed app when the user quits, provided the download is complete and verified. Quitting MUST NOT wait for an unfinished download.
- **FR-022**: If the app ends without having installed a verified update the user agreed to, the app MUST install it at the next startup before the interface appears and inform the user.
- **FR-023**: After an update on Linux, the new version MUST be runnable without any manual permission change by the user.
- **FR-024**: When the app runs as an AppImage, the update MUST replace the AppImage file the user launched.
- **FR-025**: On Windows, the update MUST complete even though the running app's file is in use.
- **FR-026**: After any successful update, the app MUST inform the user once which version it now runs.

**Safety**

- **FR-027**: A failure at any step (check, download, verification, replacement, restart) MUST leave a working installed version: either the previous one or the complete new one, never a partial file.
- **FR-028**: The app MUST keep exactly one copy of the previously installed version beside the app after an update, replacing any older copy. The project documentation MUST describe how to restore it.
- **FR-029**: Before offering an update, the app MUST determine whether it can replace its own file. If it cannot, the overlay MUST only announce the new version with release notes and the download page address, offering Close and Skip this version.
- **FR-030**: The app MUST NOT request administrator or elevated rights for any update step.
- **FR-031**: The app MUST NOT install a version lower than or equal to the installed one.
- **FR-032**: When the app is run from source rather than as a released artifact, all update checks and installs MUST be disabled, and the Options tab MUST say so.
- **FR-033**: Turning automatic updates off MUST cancel a pending "Update on exit" and discard its download.
- **FR-034**: The app MUST remove leftover partial downloads and temporary update files at startup.

**Release side**

- **FR-035**: The installed version shown to the user and used for comparison MUST come from the same single source as the published release version, so the two cannot disagree.
- **FR-036**: Project documentation MUST state that the app checks for updates by default, what it contacts, and how to turn it off.

### Key Entities

- **Installed version**: the version of the running app; shown in Options and compared against releases.
- **Available update**: a published stable release newer than the installed version: version, release notes, download size, artifact for the user's platform and its checksum.
- **Update preference**: the automatic-updates setting (on/off), persisted with the other settings.
- **Update record**: persisted facts between runs: time of the last successful check, the skipped version if any, and the pending update the user agreed to (version and whether its download is verified).
- **Previous version backup**: the single retained copy of the version replaced by the latest update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user on a personal installation goes from seeing the update offer to working in the new version in under 1 minute on a typical broadband connection, with no manual file handling.
- **SC-002**: The background check adds no perceptible delay to startup: the interface is usable as fast as with automatic updates off.
- **SC-003**: In 100% of tested failure cases (no network, interrupted download, checksum mismatch, missing checksum, no write permission, full storage, abnormal end during replacement), the app still starts afterwards.
- **SC-004**: 100% of updates on Linux, including the AppImage, start afterwards without the user changing file permissions.
- **SC-005**: With automatic updates off, the app makes zero contacts with the release source unless the user runs the manual check.
- **SC-006**: A user can find and switch off automatic updates in the Options tab in under 30 seconds.
- **SC-007**: No update flow discards unsaved work without an explicit confirmation by the user.
- **SC-008**: A user who starts the app many times a day causes at most one automatic contact with the release source per 24 hours.
- **SC-009**: Within one month of a release, at least 80% of active installations with automatic updates on run that release (measured by comparing download counts of consecutive releases).

## Assumptions

- Supported platforms stay as today: Linux x64 and Windows x64. No macOS artifact exists, so macOS is out of scope.
- The release source is this project's public GitHub releases, reached anonymously. No account or token is needed.
- Checksums published with the release protect against corrupt or incomplete downloads. They do not protect against a compromised release source; signed releases are out of scope for this feature.
- Releases published before this feature have no checksums. They are never update targets, because any install with this feature is already newer than them.
- "Unsaved work" means model changes not written to a file since the last change, or generated results not yet saved.
- The update overlay is keyboard-driven like the rest of the app.
- No usage data is sent. The only network activity is reading release information and downloading the artifact.
- The 24-hour limit and the retention of a single backup are fixed, not user-configurable.
- No automatic rollback or post-update health check: recovery from a bad release is the manual restore of the backup copy.
- Release notes are shown as published with the release; their quality is the release author's responsibility.
- Proxy configuration follows the operating system and environment conventions; no proxy settings are added to the app.
- The release process changes to publish checksums and to stamp one version into all artifacts; this is part of the feature.
