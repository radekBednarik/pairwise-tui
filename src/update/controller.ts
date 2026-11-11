import { unlink } from "node:fs/promises";
import { basename } from "node:path";
import { downloadArtifact, fetchChecksum } from "./download";
import { errorMessage, UpdateError } from "./errors";
import {
	acquireLock,
	backupPath,
	installUpdate,
	partPath,
	releaseLock,
	stagedPath,
} from "./install";
import { getInstallContext, type InstallContext } from "./platform";
import { checkForUpdate } from "./release";
import {
	type AvailableUpdate,
	EMPTY_UPDATE_RECORD,
	loadUpdateRecord,
	saveUpdateRecord,
	type UpdateRecord,
} from "./state";
import { INSTALLED_VERSION, isNewer } from "./version";

export type UpdatePhase =
	| "idle"
	| "offer"
	| "notice"
	| "unsavedWarning"
	| "downloading"
	| "error";

export type ProgressStage = "downloading" | "verifying" | "installing";

export interface UpdateProgress {
	stage: ProgressStage;
	received: number;
	total: number;
}

export interface UpdateSnapshot {
	/** Null until the install context has been resolved. */
	context: InstallContext | null;
	phase: UpdatePhase;
	/** An update was found and waits for the interface to be idle. */
	wantsOffer: boolean;
	/** The update being offered or handled. */
	available: AvailableUpdate | null;
	choiceIndex: number;
	notesScroll: number;
	progress: UpdateProgress | null;
	errorText: string;
	/** Release page address shown with some errors. */
	errorUrl: string | null;
	/** Why "Save model first" did not proceed. */
	warningError: string;
	pendingStatus: "none" | "downloading" | "ready";
	pendingVersion: string | null;
	lastCheckError: string | null;
	checking: boolean;
}

export const OFFER_CHOICES = [
	"Update now",
	"Update on exit",
	"Not now",
	"Skip this version",
] as const;
export const NOTICE_CHOICES = ["Close", "Skip this version"] as const;
export const WARNING_CHOICES = [
	"Go back",
	"Save model first",
	"Update on exit instead",
] as const;
export const ERROR_CHOICES = ["Close"] as const;

export function choicesFor(phase: UpdatePhase): readonly string[] {
	switch (phase) {
		case "offer":
			return OFFER_CHOICES;
		case "notice":
			return NOTICE_CHOICES;
		case "unsavedWarning":
			return WARNING_CHOICES;
		case "error":
			return ERROR_CHOICES;
		default:
			return [];
	}
}

const DAY_MS = 24 * 3600_000;
const HOUR_MS = 3600_000;

/** Everything the flow needs from outside, so tests can replace all of it. */
export interface UpdateDeps {
	getContext(): Promise<InstallContext>;
	loadRecord(): Promise<UpdateRecord>;
	saveRecord(record: UpdateRecord): Promise<void>;
	check(options: {
		installedVersion: string;
		assetName: string;
	}): Promise<AvailableUpdate | null>;
	fetchChecksum(options: {
		tag: string;
		assetName: string;
		signal: AbortSignal;
	}): Promise<string | null>;
	download(options: {
		tag: string;
		assetName: string;
		sizeBytes: number;
		expectedSha256: string;
		targetPath: string;
		signal: AbortSignal;
		onProgress: (received: number, total: number) => void;
	}): Promise<string>;
	install(options: {
		target: string;
		expectedSha256: string;
		identity: string | null;
		kind: NonNullable<InstallContext["kind"]>;
	}): Promise<void>;
	acquireLock(target: string): Promise<boolean>;
	releaseLock(target: string): Promise<void>;
	/** Removes the partial and the staged download. */
	removeStaged(target: string): Promise<void>;
	stagedExists(target: string): Promise<boolean>;
	now(): number;
	installedVersion: string;
}

export const DEFAULT_UPDATE_DEPS: UpdateDeps = {
	getContext: getInstallContext,
	loadRecord: () => loadUpdateRecord(),
	saveRecord: (record) => saveUpdateRecord(record),
	check: (options) => checkForUpdate(options),
	fetchChecksum: (options) => fetchChecksum(options),
	download: (options) => downloadArtifact(options),
	install: (options) => installUpdate(options),
	acquireLock: (target) => acquireLock(target),
	releaseLock,
	removeStaged: async (target) => {
		await unlink(partPath(target)).catch(() => {});
		await unlink(stagedPath(target)).catch(() => {});
	},
	stagedExists: (target) => Bun.file(stagedPath(target)).exists(),
	now: Date.now,
	installedVersion: INSTALLED_VERSION,
};

/** What the flow needs from the interface. */
export interface UpdateHost {
	/** Status line plus message log. */
	showStatus(message: string, isError?: boolean): void;
	/** Message log only: nothing pops up. */
	log(message: string, isError?: boolean): void;
	hasUnsavedWork(): boolean;
	/** Resolves true when the model was written to a file. */
	saveModel(): Promise<boolean>;
	/** Leave the interface and start the installed version. */
	restart(version: string): void;
}

function errorText(err: unknown): { text: string; withUrl: boolean } {
	if (err instanceof UpdateError) {
		switch (err.kind) {
			case "checksum-mismatch":
			case "verify-failed":
				return {
					text: "Update not installed: the download failed verification.",
					withUrl: false,
				};
			case "checksum-missing":
				return {
					text: "Update not installed: this release has no checksum.",
					withUrl: true,
				};
			case "moved":
			case "locked":
			case "busy":
				return { text: `Update not installed: ${err.message}`, withUrl: false };
			default:
				return { text: `Update failed: ${err.message}`, withUrl: false };
		}
	}
	return { text: `Update failed: ${errorMessage(err)}`, withUrl: false };
}

const INITIAL: UpdateSnapshot = {
	context: null,
	phase: "idle",
	wantsOffer: false,
	available: null,
	choiceIndex: 0,
	notesScroll: 0,
	progress: null,
	errorText: "",
	errorUrl: null,
	warningError: "",
	pendingStatus: "none",
	pendingVersion: null,
	lastCheckError: null,
	checking: false,
};

/**
 * The update flow as a plain state machine (data-model.md section 7). It owns
 * no React state: `useUpdateState` subscribes to it, the keyboard handler
 * calls its methods, and tests drive it directly.
 */
export class UpdateController {
	private snapshot: UpdateSnapshot = INITIAL;
	private readonly listeners = new Set<() => void>();
	private record: UpdateRecord = { ...EMPTY_UPDATE_RECORD };
	private initPromise: Promise<void> | null = null;
	private abort: AbortController | null = null;
	/** The download-and-install flow in flight, if any. */
	private running: Promise<void> | null = null;
	/** The user is leaving: finish or cancel, but never restart. */
	private quitting = false;
	/** An install completed while the user was quitting. */
	private installedWhileQuitting = false;

	constructor(
		private readonly deps: UpdateDeps,
		private readonly host: UpdateHost,
	) {}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = (): UpdateSnapshot => this.snapshot;

	private set(patch: Partial<UpdateSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...patch };
		for (const listener of this.listeners) listener();
	}

	private get context(): InstallContext | null {
		return this.snapshot.context;
	}

	/** Whether this install can check for updates at all. */
	private get canCheck(): boolean {
		const availability = this.context?.availability;
		return availability === "ok" || availability === "read-only";
	}

	private async save(): Promise<void> {
		try {
			await this.deps.saveRecord(this.record);
		} catch (err) {
			this.host.log(`Could not store update state: ${errorMessage(err)}`, true);
		}
	}

	/** Resolves the install context and the stored record, once. */
	init(): Promise<void> {
		this.initPromise ??= (async () => {
			const context = await this.deps.getContext();
			this.set({ context });
			if (context.kind === null) return;
			this.record = await this.deps.loadRecord();

			const from = this.record.installedFrom;
			if (from !== null) {
				if (from !== this.deps.installedVersion) {
					this.host.showStatus(
						`Updated to ${this.deps.installedVersion} (previous version kept as ${basename(backupPath(context.targetPath))})`,
					);
				}
				this.record.installedFrom = null;
				await this.save();
			}

			// An agreed update that startup could not install (another copy held
			// the lock) still waits for exit.
			const pending = this.record.pending;
			if (
				pending?.sha256 &&
				pending.targetPath === context.targetPath &&
				isNewer(pending.version, this.deps.installedVersion) &&
				(await this.deps.stagedExists(context.targetPath))
			) {
				this.set({ pendingStatus: "ready", pendingVersion: pending.version });
			}
		})();
		return this.initPromise;
	}

	private offerable(
		candidate: AvailableUpdate | null,
	): candidate is AvailableUpdate {
		return (
			candidate !== null &&
			candidate.assetName === this.context?.assetName &&
			isNewer(candidate.version, this.deps.installedVersion)
		);
	}

	/**
	 * The automatic check. Contacts the release source at most once per 24 h
	 * after a success and once per hour after a failure; a version found
	 * earlier and not skipped is offered again either way.
	 */
	async runStartupCheck(autoUpdate: boolean): Promise<void> {
		await this.init();
		if (!this.canCheck || !autoUpdate || !this.context) return;

		const now = this.deps.now();
		const since = (stamp: string | null) =>
			stamp === null ? Number.POSITIVE_INFINITY : now - Date.parse(stamp);
		const due =
			since(this.record.lastCheckAt) >= DAY_MS &&
			since(this.record.lastAttemptAt) >= HOUR_MS;

		if (due) {
			const stamp = new Date(now).toISOString();
			this.record.lastAttemptAt = stamp;
			try {
				const found = await this.deps.check({
					installedVersion: this.deps.installedVersion,
					assetName: this.context.assetName,
				});
				this.record.lastCheckAt = stamp;
				this.record.available = found;
				this.set({ lastCheckError: null });
			} catch (err) {
				const reason = errorMessage(err);
				this.set({ lastCheckError: reason });
				this.host.log(`Update check failed: ${reason}`, true);
			}
			await this.save();
		}

		const candidate = this.record.available;
		if (!this.offerable(candidate)) return;
		if (candidate.version === this.record.skippedVersion) return;
		// The check may have taken a while. If the user has meanwhile opened an
		// offer or started an update, leave that alone: the version found here
		// is stored and comes up at the next start.
		if (
			this.snapshot.phase !== "idle" ||
			this.snapshot.wantsOffer ||
			this.running !== null
		) {
			return;
		}

		const { pendingStatus, pendingVersion } = this.snapshot;
		if (pendingStatus !== "none") {
			if (
				pendingVersion === null ||
				!isNewer(candidate.version, pendingVersion)
			) {
				return;
			}
			// Something newer than what waits for exit: drop the old download.
			await this.discardPending();
		}
		this.set({ available: candidate, wantsOffer: true });
	}

	/** The manual check from the Options tab. Ignores limits and skips. */
	async checkNow(): Promise<void> {
		await this.init();
		if (!this.canCheck || !this.context) return;
		const { pendingStatus, pendingVersion, checking, phase } = this.snapshot;
		if (pendingStatus === "downloading") {
			this.host.showStatus(
				`Already downloading ${pendingVersion}, will install on exit`,
			);
			return;
		}
		if (pendingStatus === "ready") {
			this.host.showStatus(`${pendingVersion} will be installed on exit`);
			return;
		}
		if (checking || phase !== "idle") return;

		this.set({ checking: true });
		try {
			const found = await this.deps.check({
				installedVersion: this.deps.installedVersion,
				assetName: this.context.assetName,
			});
			const stamp = new Date(this.deps.now()).toISOString();
			this.record.lastCheckAt = stamp;
			this.record.lastAttemptAt = stamp;
			this.record.available = found;
			await this.save();
			this.set({ lastCheckError: null });
			if (!this.offerable(found)) {
				this.host.showStatus(
					`You are up to date (${this.deps.installedVersion})`,
				);
				return;
			}
			// Queued, not opened: like the automatic check, the offer appears
			// once nothing else is on screen and no text field is being typed
			// into. The user may have moved on while the check was running.
			this.set({ available: found, wantsOffer: true });
		} catch (err) {
			const reason = errorMessage(err);
			this.set({ lastCheckError: reason });
			this.host.showStatus(`Update check failed: ${reason}`, true);
		} finally {
			this.set({ checking: false });
		}
	}

	/** Shows the waiting offer. The interface calls this once it is idle. */
	openOffer(): void {
		if (!this.snapshot.wantsOffer || this.snapshot.phase !== "idle") return;
		const readOnly = this.context?.availability === "read-only";
		this.set({
			wantsOffer: false,
			phase: readOnly ? "notice" : "offer",
			// "Not now" / "Close": the choice that changes nothing.
			choiceIndex: readOnly ? 0 : 2,
			notesScroll: 0,
		});
	}

	// --- keyboard-facing ---

	moveChoice(delta: number): void {
		const count = choicesFor(this.snapshot.phase).length;
		if (count === 0) return;
		this.set({
			choiceIndex: (this.snapshot.choiceIndex + delta + count) % count,
		});
	}

	scrollNotes(delta: number): void {
		// Bounded by the number of lines, so scrolling back up from the end
		// never takes more presses than there are lines.
		const lines = (this.snapshot.available?.notes ?? "").split("\n").length;
		const next = this.snapshot.notesScroll + delta;
		this.set({ notesScroll: Math.min(Math.max(0, next), lines - 1) });
	}

	/** Enter on the highlighted choice. */
	confirm(): void {
		const { phase, choiceIndex } = this.snapshot;
		if (phase === "offer") {
			if (choiceIndex === 0) void this.updateNow();
			else if (choiceIndex === 1) void this.updateOnExit();
			else if (choiceIndex === 2) this.notNow();
			else void this.skipVersion();
		} else if (phase === "notice") {
			if (choiceIndex === 0) this.notNow();
			else void this.skipVersion();
		} else if (phase === "unsavedWarning") {
			if (choiceIndex === 0) this.goBack();
			else if (choiceIndex === 1) void this.saveFirst();
			else void this.updateOnExit();
		} else if (phase === "error") {
			this.closeError();
		}
	}

	/** Escape: always the choice that changes nothing. */
	escape(): void {
		const { phase } = this.snapshot;
		if (phase === "offer" || phase === "notice") this.notNow();
		else if (phase === "unsavedWarning") this.goBack();
		else if (phase === "downloading") this.cancelDownload();
		else if (phase === "error") this.closeError();
	}

	// --- choices ---

	/** Closes the offer. The found version stays cached for the next start. */
	notNow(): void {
		this.set({ phase: "idle", available: null });
	}

	async skipVersion(): Promise<void> {
		const version = this.snapshot.available?.version ?? null;
		this.set({ phase: "idle", available: null });
		if (version === null) return;
		this.record.skippedVersion = version;
		await this.save();
	}

	closeError(): void {
		this.set({ phase: "idle", available: null, errorText: "", errorUrl: null });
	}

	goBack(): void {
		this.set({ phase: "offer", choiceIndex: 0, warningError: "" });
	}

	async saveFirst(): Promise<void> {
		// Only a choice of the unsaved-work warning.
		if (this.snapshot.phase !== "unsavedWarning") return;
		let saved = false;
		try {
			saved = await this.host.saveModel();
		} catch {
			saved = false;
		}
		if (!saved) {
			this.set({ warningError: "The model could not be saved." });
			return;
		}
		await this.start("now");
	}

	async updateNow(): Promise<void> {
		if (this.context?.availability !== "ok" || !this.snapshot.available) return;
		if (this.host.hasUnsavedWork()) {
			this.set({ phase: "unsavedWarning", choiceIndex: 0, warningError: "" });
			return;
		}
		await this.start("now");
	}

	async updateOnExit(): Promise<void> {
		if (this.context?.availability !== "ok" || !this.snapshot.available) return;
		await this.start("onExit");
	}

	cancelDownload(): void {
		if (this.snapshot.phase !== "downloading") return;
		if (this.snapshot.progress?.stage === "installing") return;
		this.abort?.abort();
	}

	private start(mode: "now" | "onExit"): Promise<void> {
		// The single gate to downloading and installing: whatever called this,
		// an install that cannot replace itself never gets past here.
		if (this.context?.availability !== "ok") return Promise.resolve();
		if (this.running) return this.running;
		const flow = this.run(mode).finally(() => {
			this.running = null;
		});
		this.running = flow;
		return flow;
	}

	private async run(mode: "now" | "onExit"): Promise<void> {
		const context = this.context;
		const update = this.snapshot.available;
		if (!context || context.kind === null || !update) return;
		const target = context.targetPath;
		const foreground = mode === "now";

		if (foreground) {
			this.set({
				phase: "downloading",
				warningError: "",
				progress: {
					stage: "downloading",
					received: 0,
					total: update.sizeBytes,
				},
			});
		} else {
			this.set({
				phase: "idle",
				warningError: "",
				pendingStatus: "downloading",
				pendingVersion: update.version,
			});
		}

		const fail = (err: unknown) => {
			const cancelled = err instanceof UpdateError && err.kind === "cancelled";
			const { text, withUrl } = errorText(err);
			if (foreground) {
				this.set(
					cancelled
						? { phase: "offer", choiceIndex: 2, progress: null }
						: {
								phase: "error",
								progress: null,
								choiceIndex: 0,
								errorText: text,
								errorUrl: withUrl ? update.pageUrl : null,
							},
				);
			} else {
				this.set({ pendingStatus: "none", pendingVersion: null });
				if (!cancelled) this.host.showStatus(text, true);
			}
		};

		if (!(await this.deps.acquireLock(target))) {
			fail(new UpdateError("busy", "another copy of the app is updating"));
			return;
		}
		const abort = new AbortController();
		this.abort = abort;
		let installed = false;
		try {
			// Recorded first, so an update that is verified but not yet installed
			// when the process dies is finished at the next start (FR-022).
			this.record.pending = {
				version: update.version,
				mode,
				sha256: null,
				targetPath: target,
			};
			// Choosing to update a skipped version un-skips it.
			if (this.record.skippedVersion === update.version) {
				this.record.skippedVersion = null;
			}
			await this.save();

			const cancelled = () => new UpdateError("cancelled", "cancelled");
			let expected: string | null;
			try {
				expected = await this.deps.fetchChecksum({
					tag: update.tag,
					assetName: update.assetName,
					signal: abort.signal,
				});
			} catch (err) {
				throw abort.signal.aborted ? cancelled() : err;
			}
			if (abort.signal.aborted) throw cancelled();
			if (expected === null) {
				throw new UpdateError(
					"checksum-missing",
					"this release has no checksum",
				);
			}

			const sha256 = await this.deps.download({
				tag: update.tag,
				assetName: update.assetName,
				sizeBytes: update.sizeBytes,
				expectedSha256: expected,
				targetPath: target,
				signal: abort.signal,
				onProgress: (received, total) => {
					if (foreground && this.snapshot.phase === "downloading") {
						this.set({ progress: { stage: "downloading", received, total } });
					}
				},
			});
			// A cancel or quit that arrived just as the download completed.
			if (abort.signal.aborted) throw cancelled();
			if (foreground) {
				this.set({
					progress: {
						stage: "verifying",
						received: update.sizeBytes,
						total: update.sizeBytes,
					},
				});
			}
			this.record.pending = { ...this.record.pending, sha256 };
			await this.save();

			if (!foreground) {
				this.set({ pendingStatus: "ready" });
				this.host.showStatus(
					`${update.version} downloaded, will be installed on exit`,
				);
				return;
			}

			// Last point at which a cancel or quit still stops the update.
			if (abort.signal.aborted) throw cancelled();
			// From here on Escape is ignored: the swap must not be interrupted.
			this.set({
				progress: {
					stage: "installing",
					received: update.sizeBytes,
					total: update.sizeBytes,
				},
			});
			await this.deps.install({
				target,
				expectedSha256: sha256,
				identity: context.identity,
				kind: context.kind,
			});
			this.record.pending = null;
			this.record.available = null;
			this.record.installedFrom = this.deps.installedVersion;
			await this.save();
			installed = true;
		} catch (err) {
			this.record.pending = null;
			await this.save();
			await this.deps.removeStaged(target).catch(() => {});
			fail(err);
		} finally {
			this.abort = null;
			await this.deps.releaseLock(target).catch(() => {});
		}
		if (!installed) return;

		// The app file has been replaced. Nothing below may turn that into a
		// "failed update".
		if (this.quitting) {
			// The user asked to leave while the swap was running: it was
			// completed, and the new version starts the next time they do.
			this.installedWhileQuitting = true;
			return;
		}
		try {
			this.host.restart(update.version);
		} catch {
			this.set({ phase: "idle", progress: null, available: null });
			this.host.showStatus(
				`Updated to ${update.version}. Restart pairwise-tui to use it.`,
			);
		}
	}

	private async discardPending(): Promise<void> {
		this.abort?.abort();
		await this.running?.catch(() => {});
		const target = this.context?.targetPath;
		if (target) await this.deps.removeStaged(target).catch(() => {});
		this.record.pending = null;
		await this.save();
		this.set({ pendingStatus: "none", pendingVersion: null });
	}

	/** Turning automatic updates off cancels an update waiting for exit. */
	async setAutoUpdate(enabled: boolean): Promise<void> {
		if (!enabled && this.snapshot.pendingStatus !== "none") {
			await this.discardPending();
		}
	}

	/** Whether quitting has anything to finish or cancel first. */
	needsQuitWork(): boolean {
		return this.running !== null || this.snapshot.pendingStatus === "ready";
	}

	/**
	 * Called when the user quits. Installs a verified update that waits for
	 * exit and resolves true when the app file was replaced. A download still
	 * running is cancelled, never waited for.
	 */
	async finishOnQuit(): Promise<boolean> {
		const context = this.context;
		if (!context || context.kind === null) return false;
		const target = context.targetPath;

		this.quitting = true;
		if (this.running) {
			// Cancels a download or checksum fetch at once. A swap that has
			// already begun is not interruptible and is completed; either way
			// the flow must not restart the app the user is leaving.
			this.abort?.abort();
			await this.running.catch(() => {});
			return this.installedWhileQuitting;
		}
		const pending = this.record.pending;
		if (this.snapshot.pendingStatus !== "ready" || !pending?.sha256) {
			return false;
		}
		if (!(await this.deps.acquireLock(target))) return false;
		try {
			await this.deps.install({
				target,
				expectedSha256: pending.sha256,
				identity: context.identity,
				kind: context.kind,
			});
			this.record.pending = null;
			this.record.available = null;
			this.record.installedFrom = this.deps.installedVersion;
			await this.save();
			this.set({ pendingStatus: "none", pendingVersion: null });
			return true;
		} catch (err) {
			// A backup still locked by a running copy clears by itself: keep the
			// agreed update for the next start. Anything else is final.
			if (!(err instanceof UpdateError && err.kind === "locked")) {
				this.record.pending = null;
				await this.save();
				await this.deps.removeStaged(target).catch(() => {});
			}
			return false;
		} finally {
			await this.deps.releaseLock(target).catch(() => {});
		}
	}
}

/** The state line of the Options tab's Updates section, or null for none. */
export function updateStateText(snapshot: UpdateSnapshot): string | null {
	const availability = snapshot.context?.availability;
	if (availability === "source-run") {
		return "Updates unavailable when running from source";
	}
	if (availability === "unsupported-platform") {
		return "Updates unavailable on this platform";
	}
	if (snapshot.pendingStatus === "downloading") {
		return `Downloading ${snapshot.pendingVersion}, will install on exit`;
	}
	if (snapshot.pendingStatus === "ready") {
		return `${snapshot.pendingVersion} will be installed on exit`;
	}
	if (availability === "read-only") {
		return "Self-update unavailable: no write permission for the app's folder";
	}
	if (snapshot.lastCheckError !== null) {
		return `Last update check failed: ${snapshot.lastCheckError}`;
	}
	return null;
}

/** Whether this run can check for updates at all. */
export function updatesAvailable(snapshot: UpdateSnapshot): boolean {
	const availability = snapshot.context?.availability;
	return availability === "ok" || availability === "read-only";
}
