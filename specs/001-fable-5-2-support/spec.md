# Feature Specification: Fable 5.2 AI Model Support

**Feature Branch**: `001-fable-5-2-support`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "update AI support - Fable 5.2 was released. Switch supported Fable to this version. Update all mentions of versions - docs, readme, in-app docs, etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a model with Fable 5.2 (Priority: P1)

A tester who wants the most capable AI assistance opens the Options tab, cycles the AI Model field and finds "Fable 5.2" in place of "Fable 5.1". They select it, describe their system under test in the AI prompt, and get a generated PICT model produced by Fable 5.2.

**Why this priority**: This is the core of the request. Without it the app keeps offering an outdated top-tier model that costs more than its successor.

**Independent Test**: Cycle the AI Model field through every option, confirm the list reads Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.2 (no Fable 5.1), select Fable 5.2 and run an AI generation. The request goes to Fable 5.2 and a model is returned.

**Acceptance Scenarios**:

1. **Given** the Options tab is open, **When** the user cycles the AI Model field through all values, **Then** exactly four models are offered, in the order Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.2, and Fable 5.1 is not among them.
2. **Given** Fable 5.2 is selected, **When** the user opens the AI prompt overlay, **Then** the overlay names "Fable 5.2" as the model in use.
3. **Given** Fable 5.2 is selected and a valid API key is set, **When** the user submits a prompt, **Then** the generation request names the Fable 5.2 model and the returned model is loaded exactly as it is for the other models.
4. **Given** Fable 5.2 is selected, **When** the user cycles the AI Model field once more, **Then** the selection wraps around to Haiku 5.5.

---

### User Story 2 - Saved Fable 5.1 choice carries over (Priority: P2)

A returning user who previously chose Fable 5.1 upgrades the app. On launch, their saved choice is carried over to Fable 5.2 instead of silently resetting to the default model.

**Why this priority**: Users who picked the top model did so on purpose. Silently dropping them to the default would change the quality and cost of their generations without notice. The app already carries over other retired models this way, so users expect it.

**Independent Test**: Start the app with saved settings that name Fable 5.1 and check that the Options tab shows Fable 5.2 as the selected model.

**Acceptance Scenarios**:

1. **Given** saved settings that name Fable 5.1, **When** the app starts, **Then** Fable 5.2 is the selected AI model.
2. **Given** saved settings that name an earlier retired model the app already carries over (Opus 5, Sonnet 5, Haiku 4.5), **When** the app starts, **Then** that model is still carried over to its current replacement, as before.
3. **Given** saved settings that name an unknown model, **When** the app starts, **Then** the default model (Sonnet 5.5) is selected, as before.
4. **Given** a carried-over Fable 5.2 choice, **When** settings are next saved, **Then** Fable 5.2 is what gets stored.

---

### User Story 3 - Documentation names the current models (Priority: P3)

A user reading the README, the project website or the in-app help sees Fable 5.2 described as the most capable option, with its data-retention requirement, and no remaining references to Fable 5.1 as a supported model.

**Why this priority**: Out-of-date docs mislead users about which model they get and what it requires, but they don't stop the feature from working.

**Independent Test**: Search all user-facing documentation (README, project website, in-app help) for "Fable"; every mention names 5.2 and no supported-model listing names 5.1.

**Acceptance Scenarios**:

1. **Given** the README, **When** a user reads the AI model section, **Then** the model table lists Fable 5.2 as most capable, slowest and highest cost, and the retention note names Fable 5.2.
2. **Given** the project website, **When** a user reads the AI model table and its footnote, **Then** both name Fable 5.2.
3. **Given** the in-app help, **When** a user opens the Options and AI sections, **Then** the AI Model option lists "Haiku 5.5 / Sonnet 5.5 / Opus 5.5 / Fable 5.2", and the model descriptions and retention note name Fable 5.2.
4. **Given** the project's internal notes and code comments that describe model behaviour, **When** a maintainer reads them, **Then** they describe Fable 5.2 rather than Fable 5.1.

---

### Edge Cases

- The user's organization uses zero data retention: Fable 5.2, like Fable 5.1, requires 30-day data retention, so the service rejects the request. The app shows the service's error the same way it does today for Fable 5.1, and the docs keep warning about this.
- A model file or settings file written by an older version names Fable 5.1: settings carry over to Fable 5.2 (User Story 2). Model files don't store the AI model, so they are unaffected.
- Fable 5.2 can take noticeably longer on hard prompts: the app's existing waiting behaviour for long generations applies unchanged.
- Generation settings sent with every request (thinking left at the model default, effort pinned to "high", output limit) must stay valid for Fable 5.2. Fable 5.2 keeps thinking always on and accepts the same effort levels as Fable 5.1, so no request change is expected beyond the model name.
- Historical records (changelog entries, release notes, past commit messages) that mention Fable 5.1 describe past releases and are left as written.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer Fable 5.2 as a selectable AI model, labelled "Fable 5.2", in the position Fable 5.1 held (last, after Opus 5.5).
- **FR-002**: The app MUST NOT offer Fable 5.1 as a selectable AI model.
- **FR-003**: When Fable 5.2 is selected, AI generation requests MUST name the Fable 5.2 model and otherwise behave the same as for Fable 5.1 (same prompt, same output handling, same generation settings).
- **FR-004**: On load, a saved AI model choice of Fable 5.1 MUST be replaced with Fable 5.2. Existing carry-overs for other retired models and the fallback to the default for unknown values MUST keep working unchanged.
- **FR-005**: The default AI model MUST remain Sonnet 5.5.
- **FR-006**: The README MUST list Fable 5.2 in its AI model table and name Fable 5.2 in the data-retention note.
- **FR-007**: The project website MUST list Fable 5.2 in its AI model table and name Fable 5.2 in the data-retention note.
- **FR-008**: The in-app help MUST name Fable 5.2 wherever it lists or describes the available AI models, including the data-retention note.
- **FR-009**: Code comments and project notes that describe how the supported models behave MUST refer to Fable 5.2 and stay accurate for it.
- **FR-010**: After the change, no user-facing text (UI, in-app help, README, website) MAY refer to Fable 5.1 as a supported model. The settings carry-over and historical records are the only places Fable 5.1 may still appear.
- **FR-011**: The app MUST use the current major release of the Anthropic client library (1.x, latest at planning time 1.7.0) in place of 0.129. AI generation MUST keep working exactly as before for all four models: same prompt, same result handling, same error messages.
- **FR-012**: The automated tests that cover model cycling, the model sent with a generation request and saved-setting carry-over MUST be updated or extended to cover Fable 5.2 and the Fable 5.1 carry-over.

### Key Entities

- **AI model option**: one selectable model, with an identifier the service recognises and a display label shown in the Options tab, the AI prompt overlay and the help. The supported set after this change is Haiku 5.5, Sonnet 5.5, Opus 5.5 and Fable 5.2.
- **Retired model carry-over**: a mapping from a model the app used to offer to the model that replaced it, applied to saved settings at load time. Gains the entry Fable 5.1 → Fable 5.2.
- **Saved settings**: the user's persisted preferences, including the chosen AI model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cycling the AI Model field shows exactly 4 models, and Fable 5.2 is reachable from the default selection in 2 presses.
- **SC-002**: 100% of AI generations run with Fable 5.2 selected are sent to Fable 5.2, and a successful response loads a model the same way as for the other three models.
- **SC-003**: 100% of users whose saved choice was Fable 5.1 start the upgraded app with Fable 5.2 selected, with no manual step.
- **SC-004**: A search of the UI text, in-app help, README and website for "Fable 5.1" finds 0 matches.
- **SC-005**: The project depends on, and the lockfile resolves, the Anthropic client library 1.x, with a single copy installed.
- **SC-006**: The full automated test suite, lint check and type check all pass after the change.

## Assumptions

- Fable 5.2 is a drop-in successor to Fable 5.1 for this app's use: same request shape, thinking always on, same effort levels, the same 30-day data-retention requirement (not available under zero data retention), and a lower price than Fable 5.1.
- "Switch supported Fable to this version" means replace Fable 5.1, not offer both. Users who want 5.1 specifically are out of scope.
- The descriptive wording for Fable in the docs ("most capable, slowest and highest cost") stays. Fable 5.2 costs less than Fable 5.1 but is still the most expensive of the four offered models.
- Only Fable changes. Haiku 5.5, Sonnet 5.5 and Opus 5.5 remain the current versions and are not touched.
- Upgrading the Anthropic client library is in scope (requested by the user on 2026-11-10). The 1.x release moves requests to the newer API version (2026-10-21) and sends the API key in a different header. The app uses none of the features that version removes, and it talks to the API directly, with no proxy, so users should see no difference.
- A version bump and a changelog or release-note entry follow the project's usual release process and are not part of this specification.
- The project constitution (`.specify/memory/constitution.md`) is still the unfilled template, so it adds no constraints. The project's own conventions apply instead: tests first, then a code and security review, and no change to existing behaviour beyond what is specified.
