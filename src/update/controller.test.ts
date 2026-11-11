import { expect, test } from "bun:test";
import {
	OFFER_CHOICES,
	UpdateController,
	type UpdateDeps,
	type UpdateHost,
	type UpdateSnapshot,
	updateStateText,
	updatesAvailable,
} from "./controller";
import { UpdateError } from "./errors";
import type { Availability, InstallContext } from "./platform";
import {
	type AvailableUpdate,
	EMPTY_UPDATE_RECORD,
	type UpdateRecord,
} from "./state";

const TARGET = "/opt/app/pairwise-tui";
const SHA = "c".repeat(64);
const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3600_000;

function update(version = "1.8.0"): AvailableUpdate {
	return {
		version,
		tag: `v${version}`,
		notes: "notes",
		pageUrl: `https://github.com/radekBednarik/pairwise-tui/releases/tag/v${version}`,
		assetName: "pairwise-tui",
		sizeBytes: 1000,
	};
}

interface Setup {
	availability?: Availability;
	kind?: InstallContext["kind"];
	record?: Partial<UpdateRecord>;
	check?: () => Promise<AvailableUpdate | null>;
	checksum?: () => Promise<string | null>;
	download?: UpdateDeps["download"];
	install?: UpdateDeps["install"];
	lock?: boolean;
	staged?: boolean;
	unsaved?: boolean;
	saveModel?: () => Promise<boolean>;
}

function make(setup: Setup = {}) {
	const calls: string[] = [];
	const status: Array<{ text: string; error: boolean }> = [];
	const logged: Array<{ text: string; error: boolean }> = [];
	let record: UpdateRecord = { ...EMPTY_UPDATE_RECORD, ...setup.record };
	const state = { unsaved: setup.unsaved ?? false, lock: setup.lock ?? true };

	const availability = setup.availability ?? "ok";
	const unavailable =
		availability === "source-run" || availability === "unsupported-platform";
	const context: InstallContext = unavailable
		? {
				kind: null,
				targetPath: "",
				assetName: "",
				availability,
				identity: null,
			}
		: {
				kind: setup.kind === undefined ? "linux" : setup.kind,
				targetPath: TARGET,
				assetName: "pairwise-tui",
				availability,
				identity: "1:2",
			};

	const deps: UpdateDeps = {
		getContext: async () => context,
		loadRecord: async () => structuredClone(record),
		saveRecord: async (r) => {
			record = structuredClone(r);
		},
		check: async () => {
			calls.push("check");
			return setup.check ? setup.check() : update();
		},
		fetchChecksum: async () => {
			calls.push("checksum");
			return setup.checksum ? setup.checksum() : SHA;
		},
		download: async (options) => {
			calls.push("download");
			if (setup.download) return setup.download(options);
			options.onProgress(500, 1000);
			options.onProgress(1000, 1000);
			return SHA;
		},
		install: async (options) => {
			calls.push("install");
			if (setup.install) return setup.install(options);
		},
		acquireLock: async () => {
			calls.push("lock");
			return state.lock;
		},
		releaseLock: async () => {
			calls.push("unlock");
		},
		removeStaged: async () => {
			calls.push("removeStaged");
		},
		stagedExists: async () => setup.staged ?? false,
		now: () => NOW,
		installedVersion: "1.7.0",
	};
	const host: UpdateHost = {
		showStatus: (text, error = false) => status.push({ text, error }),
		log: (text, error = false) => logged.push({ text, error }),
		hasUnsavedWork: () => state.unsaved,
		saveModel: async () => {
			calls.push("saveModel");
			return setup.saveModel ? setup.saveModel() : true;
		},
		restart: (version) => calls.push(`restart ${version}`),
	};
	const controller = new UpdateController(deps, host);
	return {
		controller,
		calls,
		status,
		logged,
		state,
		snap: () => controller.getSnapshot(),
		record: () => record,
	};
}

/** A found update with the offer already on screen. */
async function offered(setup: Setup = {}) {
	const h = make(setup);
	await h.controller.runStartupCheck(true);
	h.controller.openOffer();
	h.calls.length = 0;
	return h;
}

/** A download the test finishes or fails by hand. */
function heldDownload() {
	let resolve: (sha: string) => void = () => {};
	let reject: (err: unknown) => void = () => {};
	let signal: AbortSignal | undefined;
	const download: UpdateDeps["download"] = (options) => {
		signal = options.signal;
		options.onProgress(250, 1000);
		return new Promise<string>((res, rej) => {
			resolve = res;
			reject = rej;
			options.signal.addEventListener("abort", () =>
				rej(new UpdateError("cancelled", "cancelled")),
			);
		});
	};
	return {
		download,
		resolve: (sha = SHA) => resolve(sha),
		reject: (err: unknown) => reject(err),
		aborted: () => signal?.aborted ?? false,
	};
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// --- the automatic check ---

test("the first startup check finds an update and waits to offer it", async () => {
	const h = make();
	await h.controller.runStartupCheck(true);
	expect(h.calls).toEqual(["check"]);
	expect(h.record().lastCheckAt).toBe(new Date(NOW).toISOString());
	expect(h.record().lastAttemptAt).toBe(new Date(NOW).toISOString());
	expect(h.record().available?.version).toBe("1.8.0");
	expect(h.snap().phase).toBe("idle");
	expect(h.snap().wantsOffer).toBe(true);

	h.controller.openOffer();
	expect(h.snap().phase).toBe("offer");
	expect(h.snap().wantsOffer).toBe(false);
	expect(OFFER_CHOICES[h.snap().choiceIndex]).toBe("Not now");
	expect(h.snap().available?.version).toBe("1.8.0");
});

test("no check when the app cannot update at all", async () => {
	for (const availability of ["source-run", "unsupported-platform"] as const) {
		const h = make({ availability });
		await h.controller.runStartupCheck(true);
		await h.controller.checkNow();
		expect(h.calls).toEqual([]);
		expect(h.snap().wantsOffer).toBe(false);
	}
});

test("no automatic check when automatic updates are off", async () => {
	const h = make({ record: { available: update() } });
	await h.controller.runStartupCheck(false);
	expect(h.calls).toEqual([]);
	expect(h.snap().wantsOffer).toBe(false);
});

test("a failed automatic check is silent apart from the message log", async () => {
	const h = make({
		check: async () => {
			throw new Error("HTTP 403");
		},
	});
	await h.controller.runStartupCheck(true);
	expect(h.snap().phase).toBe("idle");
	expect(h.snap().wantsOffer).toBe(false);
	expect(h.snap().lastCheckError).toBe("HTTP 403");
	expect(h.status).toEqual([]);
	expect(h.logged).toEqual([
		{ text: "Update check failed: HTTP 403", error: true },
	]);
	expect(h.record().lastCheckAt).toBeNull();
	expect(h.record().lastAttemptAt).toBe(new Date(NOW).toISOString());
});

test("within 24 h of a success a cached update is re-offered without a request", async () => {
	const h = make({
		record: {
			lastCheckAt: ago(2 * HOUR),
			lastAttemptAt: ago(2 * HOUR),
			available: update(),
		},
	});
	await h.controller.runStartupCheck(true);
	expect(h.calls).toEqual([]);
	expect(h.snap().wantsOffer).toBe(true);
});

test("within 24 h of a success and nothing cached, nothing happens", async () => {
	const h = make({
		record: { lastCheckAt: ago(2 * HOUR), lastAttemptAt: ago(2 * HOUR) },
	});
	await h.controller.runStartupCheck(true);
	expect(h.calls).toEqual([]);
	expect(h.snap().wantsOffer).toBe(false);
});

test("after 24 h the source is asked again", async () => {
	const h = make({
		record: { lastCheckAt: ago(25 * HOUR), lastAttemptAt: ago(25 * HOUR) },
	});
	await h.controller.runStartupCheck(true);
	expect(h.calls).toEqual(["check"]);
});

test("a failed attempt is retried no sooner than an hour later", async () => {
	const early = make({
		record: { lastCheckAt: ago(30 * HOUR), lastAttemptAt: ago(0.5 * HOUR) },
	});
	await early.controller.runStartupCheck(true);
	expect(early.calls).toEqual([]);

	const later = make({
		record: { lastCheckAt: ago(30 * HOUR), lastAttemptAt: ago(1.5 * HOUR) },
	});
	await later.controller.runStartupCheck(true);
	expect(later.calls).toEqual(["check"]);
});

test("a cached update is still offered when the due check fails", async () => {
	const h = make({
		record: { lastCheckAt: ago(30 * HOUR), available: update() },
		check: async () => {
			throw new Error("offline");
		},
	});
	await h.controller.runStartupCheck(true);
	expect(h.snap().wantsOffer).toBe(true);
	expect(h.status).toEqual([]);
	expect(h.logged).toHaveLength(1);
});

test("a check that finds nothing clears the cached update", async () => {
	const h = make({
		record: { lastCheckAt: ago(30 * HOUR), available: update() },
		check: async () => null,
	});
	await h.controller.runStartupCheck(true);
	expect(h.record().available).toBeNull();
	expect(h.snap().wantsOffer).toBe(false);
});

test("a cached update for another artifact or an old version is not offered", async () => {
	const other = make({
		record: {
			lastCheckAt: ago(HOUR),
			available: { ...update(), assetName: "pairwise-tui.exe" },
		},
	});
	await other.controller.runStartupCheck(true);
	expect(other.snap().wantsOffer).toBe(false);

	const old = make({
		record: { lastCheckAt: ago(HOUR), available: update("1.7.0") },
	});
	await old.controller.runStartupCheck(true);
	expect(old.snap().wantsOffer).toBe(false);
});

// --- not now, skip ---

test("'Not now' closes the offer and keeps the update for the next start", async () => {
	const h = await offered();
	h.controller.notNow();
	expect(h.snap().phase).toBe("idle");
	expect(h.record().available?.version).toBe("1.8.0");
	expect(h.record().skippedVersion).toBeNull();
	expect(h.calls).toEqual([]);
});

test("'Skip this version' silences exactly that version", async () => {
	const h = await offered();
	await h.controller.skipVersion();
	expect(h.snap().phase).toBe("idle");
	expect(h.record().skippedVersion).toBe("1.8.0");
	expect(h.calls).toEqual([]);

	const same = make({
		record: {
			lastCheckAt: ago(HOUR),
			available: update(),
			skippedVersion: "1.8.0",
		},
	});
	await same.controller.runStartupCheck(true);
	expect(same.snap().wantsOffer).toBe(false);

	const newer = make({
		record: {
			lastCheckAt: ago(HOUR),
			available: update("1.9.0"),
			skippedVersion: "1.8.0",
		},
	});
	await newer.controller.runStartupCheck(true);
	expect(newer.snap().wantsOffer).toBe(true);
});

// --- choices by keyboard ---

test("choices wrap around and Enter runs the highlighted one", async () => {
	const h = await offered();
	h.controller.moveChoice(1);
	expect(OFFER_CHOICES[h.snap().choiceIndex]).toBe("Skip this version");
	h.controller.moveChoice(1);
	expect(OFFER_CHOICES[h.snap().choiceIndex]).toBe("Update now");
	h.controller.moveChoice(-1);
	expect(OFFER_CHOICES[h.snap().choiceIndex]).toBe("Skip this version");
	h.controller.confirm();
	await tick();
	expect(h.record().skippedVersion).toBe("1.8.0");
});

test("Escape on the offer is 'Not now'", async () => {
	const h = await offered();
	h.controller.escape();
	expect(h.snap().phase).toBe("idle");
	expect(h.record().skippedVersion).toBeNull();
});

test("notes scrolling stays within the notes", async () => {
	const h = await offered({
		record: {
			lastCheckAt: ago(HOUR),
			available: { ...update(), notes: "a\nb\nc\nd\ne" },
		},
	});
	h.controller.scrollNotes(-5);
	expect(h.snap().notesScroll).toBe(0);
	h.controller.scrollNotes(3);
	h.controller.scrollNotes(-1);
	expect(h.snap().notesScroll).toBe(2);
	h.controller.scrollNotes(100);
	expect(h.snap().notesScroll).toBe(4);
});

// --- update now ---

test("'Update now' downloads, verifies, installs and restarts", async () => {
	const stages: string[] = [];
	const h = await offered();
	h.controller.subscribe(() => {
		const stage = h.snap().progress?.stage;
		if (stage && stages.at(-1) !== stage) stages.push(stage);
	});
	await h.controller.updateNow();

	expect(h.calls).toEqual([
		"lock",
		"checksum",
		"download",
		"install",
		"unlock",
		"restart 1.8.0",
		"unlock",
	]);
	expect(stages).toEqual(["downloading", "verifying", "installing"]);
	expect(h.record().pending).toBeNull();
	expect(h.record().installedFrom).toBe("1.7.0");
	expect(h.record().available).toBeNull();
});

test("'Update now' records its agreement before and after verification", async () => {
	const held = heldDownload();
	const h = await offered({ download: held.download });
	const flow = h.controller.updateNow();
	await tick();

	expect(h.snap().phase).toBe("downloading");
	expect(h.snap().progress).toEqual({
		stage: "downloading",
		received: 250,
		total: 1000,
	});
	expect(h.record().pending).toEqual({
		version: "1.8.0",
		mode: "now",
		sha256: null,
		targetPath: TARGET,
	});

	let pendingAtInstall: unknown;
	const deps = h.controller as unknown as { deps: UpdateDeps };
	const realInstall = deps.deps.install;
	deps.deps.install = async (options) => {
		pendingAtInstall = structuredClone(h.record().pending);
		return realInstall(options);
	};
	held.resolve();
	await flow;
	expect(pendingAtInstall).toEqual({
		version: "1.8.0",
		mode: "now",
		sha256: SHA,
		targetPath: TARGET,
	});
});

test("the install gets the verified hash, the target and its startup identity", async () => {
	let seen: unknown;
	const h = await offered({
		install: async (options) => {
			seen = options;
		},
	});
	await h.controller.updateNow();
	expect(seen).toEqual({
		target: TARGET,
		expectedSha256: SHA,
		identity: "1:2",
		kind: "linux",
	});
});

test("a release without a checksum is refused before any download", async () => {
	const h = await offered({ checksum: async () => null });
	await h.controller.updateNow();
	expect(h.calls).toEqual(["lock", "checksum", "removeStaged", "unlock"]);
	expect(h.snap().phase).toBe("error");
	expect(h.snap().errorText).toBe(
		"Update not installed: this release has no checksum.",
	);
	expect(h.snap().errorUrl).toBe(update().pageUrl);
	expect(h.record().pending).toBeNull();
});

const failures: Array<[string, () => never, string]> = [
	[
		"a checksum mismatch",
		() => {
			throw new UpdateError("checksum-mismatch", "x");
		},
		"Update not installed: the download failed verification.",
	],
	[
		"a network failure",
		() => {
			throw new UpdateError("network", "HTTP 502");
		},
		"Update failed: HTTP 502",
	],
	[
		"a full disk",
		() => {
			throw new UpdateError("storage", "ENOSPC: no space left on device");
		},
		"Update failed: ENOSPC: no space left on device",
	],
	[
		"an oversized download",
		() => {
			throw new UpdateError(
				"too-large",
				"the download is larger than the release announced",
			);
		},
		"Update failed: the download is larger than the release announced",
	],
	[
		"an unexpected error",
		() => {
			throw new Error("boom");
		},
		"Update failed: boom",
	],
];

for (const [name, thrower, text] of failures) {
	test(`${name} during download shows the error and cleans up`, async () => {
		const h = await offered({ download: async () => thrower() });
		await h.controller.updateNow();
		expect(h.snap().phase).toBe("error");
		expect(h.snap().errorText).toBe(text);
		expect(h.snap().errorUrl).toBeNull();
		expect(h.record().pending).toBeNull();
		expect(h.calls).toContain("removeStaged");
		expect(h.calls.at(-1)).toBe("unlock");
		expect(h.calls).not.toContain("install");
		expect(h.calls.some((c) => c.startsWith("restart"))).toBe(false);

		// Closing the error returns to idle and keeps the update for later.
		h.controller.closeError();
		expect(h.snap().phase).toBe("idle");
		expect(h.record().available?.version).toBe("1.8.0");
	});
}

const installFailures: Array<[UpdateError, string]> = [
	[
		new UpdateError("verify-failed", "x"),
		"Update not installed: the download failed verification.",
	],
	[
		new UpdateError(
			"moved",
			"the app file was moved or replaced since it started",
		),
		"Update not installed: the app file was moved or replaced since it started",
	],
	[
		new UpdateError("locked", "the previous version is still in use"),
		"Update not installed: the previous version is still in use",
	],
	[new UpdateError("storage", "EIO"), "Update failed: EIO"],
];

for (const [err, text] of installFailures) {
	test(`an install refused as ${err.kind} keeps the app running`, async () => {
		const h = await offered({
			install: async () => {
				throw err;
			},
		});
		await h.controller.updateNow();
		expect(h.snap().phase).toBe("error");
		expect(h.snap().errorText).toBe(text);
		expect(h.record().pending).toBeNull();
		expect(h.record().installedFrom).toBeNull();
		expect(h.calls.some((c) => c.startsWith("restart"))).toBe(false);
		expect(h.calls.at(-1)).toBe("unlock");
	});
}

test("another copy holding the lock is reported and nothing is downloaded", async () => {
	const h = await offered({ lock: false });
	await h.controller.updateNow();
	expect(h.calls).toEqual(["lock"]);
	expect(h.snap().phase).toBe("error");
	expect(h.snap().errorText).toBe(
		"Update not installed: another copy of the app is updating",
	);
});

test("cancelling the download returns to the offer", async () => {
	const held = heldDownload();
	const h = await offered({ download: held.download });
	const flow = h.controller.updateNow();
	await tick();
	h.controller.escape();
	await flow;
	expect(held.aborted()).toBe(true);
	expect(h.snap().phase).toBe("offer");
	expect(h.snap().progress).toBeNull();
	expect(h.record().pending).toBeNull();
	expect(h.calls).toContain("removeStaged");
	expect(h.calls).not.toContain("install");
});

test("Escape is ignored once installing has started", async () => {
	let release: () => void = () => {};
	const gate = new Promise<void>((r) => {
		release = r;
	});
	const h = await offered({ install: () => gate });
	const flow = h.controller.updateNow();
	await tick();
	await tick();
	expect(h.snap().progress?.stage).toBe("installing");
	h.controller.escape();
	release();
	await flow;
	expect(h.calls).toContain("restart 1.8.0");
});

// --- update on exit ---

test("'Update on exit' downloads in the background and waits for quit", async () => {
	const held = heldDownload();
	const h = await offered({ download: held.download });
	const flow = h.controller.updateOnExit();
	await tick();

	expect(h.snap().phase).toBe("idle");
	expect(h.snap().pendingStatus).toBe("downloading");
	expect(h.snap().pendingVersion).toBe("1.8.0");
	expect(h.record().pending).toEqual({
		version: "1.8.0",
		mode: "onExit",
		sha256: null,
		targetPath: TARGET,
	});

	held.resolve();
	await flow;
	expect(h.snap().pendingStatus).toBe("ready");
	expect(h.record().pending?.sha256).toBe(SHA);
	expect(h.calls).not.toContain("install");
	expect(h.calls.at(-1)).toBe("unlock");
	expect(h.status.at(-1)?.text).toBe(
		"1.8.0 downloaded, will be installed on exit",
	);
});

test("a background failure is one status message and no overlay", async () => {
	const h = await offered({
		download: async () => {
			throw new UpdateError("network", "HTTP 502");
		},
	});
	await h.controller.updateOnExit();
	expect(h.snap().phase).toBe("idle");
	expect(h.snap().pendingStatus).toBe("none");
	expect(h.record().pending).toBeNull();
	expect(h.status).toEqual([{ text: "Update failed: HTTP 502", error: true }]);
});

test("quitting with a verified update installs it", async () => {
	const h = await offered();
	await h.controller.updateOnExit();
	h.calls.length = 0;

	expect(await h.controller.finishOnQuit()).toBe(true);
	expect(h.calls).toEqual(["lock", "install", "unlock"]);
	expect(h.record().pending).toBeNull();
	expect(h.record().installedFrom).toBe("1.7.0");
});

test("quitting during the download cancels it and installs nothing", async () => {
	const held = heldDownload();
	const h = await offered({ download: held.download });
	void h.controller.updateOnExit();
	await tick();

	expect(await h.controller.finishOnQuit()).toBe(false);
	expect(held.aborted()).toBe(true);
	expect(h.calls).not.toContain("install");
	expect(h.calls).toContain("removeStaged");
	expect(h.record().pending).toBeNull();
	expect(h.status).toEqual([]);
});

test("quitting with nothing pending does nothing", async () => {
	const h = make();
	await h.controller.init();
	expect(await h.controller.finishOnQuit()).toBe(false);
	expect(h.calls).toEqual([]);
});

test("a failed install on quit never blocks the exit", async () => {
	const h = await offered({
		install: async () => {
			throw new UpdateError("storage", "EIO");
		},
	});
	await h.controller.updateOnExit();
	expect(await h.controller.finishOnQuit()).toBe(false);
	expect(h.record().pending).toBeNull();
	expect(h.calls.at(-1)).toBe("unlock");
});

test("a backup locked on quit keeps the update for the next start", async () => {
	const h = await offered({
		install: async () => {
			throw new UpdateError("locked", "in use");
		},
	});
	await h.controller.updateOnExit();
	expect(await h.controller.finishOnQuit()).toBe(false);
	expect(h.record().pending?.sha256).toBe(SHA);
});

test("a verified update left by an earlier run still waits for exit", async () => {
	const h = make({
		staged: true,
		record: {
			pending: {
				version: "1.8.0",
				mode: "onExit",
				sha256: SHA,
				targetPath: TARGET,
			},
			lastCheckAt: ago(HOUR),
			available: update(),
		},
	});
	await h.controller.runStartupCheck(true);
	expect(h.snap().pendingStatus).toBe("ready");
	// Already agreed to: not offered a second time.
	expect(h.snap().wantsOffer).toBe(false);
	expect(await h.controller.finishOnQuit()).toBe(true);
});

test("a newer version replaces an older one that waits for exit", async () => {
	const h = make({
		staged: true,
		record: {
			pending: {
				version: "1.8.0",
				mode: "onExit",
				sha256: SHA,
				targetPath: TARGET,
			},
			lastCheckAt: ago(HOUR),
			available: update("1.9.0"),
		},
	});
	await h.controller.runStartupCheck(true);
	expect(h.calls).toContain("removeStaged");
	expect(h.snap().pendingStatus).toBe("none");
	expect(h.record().pending).toBeNull();
	expect(h.snap().wantsOffer).toBe(true);
	expect(h.snap().available?.version).toBe("1.9.0");
});

test("turning automatic updates off cancels an update waiting for exit", async () => {
	const ready = await offered();
	await ready.controller.updateOnExit();
	ready.calls.length = 0;
	await ready.controller.setAutoUpdate(false);
	expect(ready.calls).toContain("removeStaged");
	expect(ready.snap().pendingStatus).toBe("none");
	expect(ready.record().pending).toBeNull();
	expect(await ready.controller.finishOnQuit()).toBe(false);

	const held = heldDownload();
	const downloading = await offered({ download: held.download });
	void downloading.controller.updateOnExit();
	await tick();
	await downloading.controller.setAutoUpdate(false);
	expect(held.aborted()).toBe(true);
	expect(downloading.snap().pendingStatus).toBe("none");
	expect(downloading.record().pending).toBeNull();
});

// --- the manual check ---

test("the manual check ignores the limits and the skipped version", async () => {
	const h = make({
		record: {
			lastCheckAt: ago(HOUR),
			lastAttemptAt: ago(60_000),
			skippedVersion: "1.8.0",
		},
	});
	await h.controller.checkNow();
	expect(h.calls).toEqual(["check"]);
	expect(h.snap().phase).toBe("offer");
	expect(h.snap().available?.version).toBe("1.8.0");
});

test("the manual check works with automatic updates off", async () => {
	const h = make();
	await h.controller.runStartupCheck(false);
	await h.controller.checkNow();
	expect(h.calls).toEqual(["check"]);
	expect(h.snap().phase).toBe("offer");
});

test("the manual check says so when up to date", async () => {
	const h = make({ check: async () => null });
	await h.controller.checkNow();
	expect(h.status).toEqual([
		{ text: "You are up to date (1.7.0)", error: false },
	]);
	expect(h.snap().phase).toBe("idle");
});

test("a failed manual check is reported with its reason", async () => {
	const h = make({
		check: async () => {
			throw new Error("timed out");
		},
	});
	await h.controller.checkNow();
	expect(h.status).toEqual([
		{ text: "Update check failed: timed out", error: true },
	]);
	expect(h.snap().lastCheckError).toBe("timed out");
});

test("the manual check only reports while an update is pending", async () => {
	const held = heldDownload();
	const h = await offered({ download: held.download });
	const flow = h.controller.updateOnExit();
	await tick();
	h.calls.length = 0;

	await h.controller.checkNow();
	expect(h.calls).toEqual([]);
	expect(h.status.at(-1)?.text).toBe(
		"Already downloading 1.8.0, will install on exit",
	);

	held.resolve();
	await flow;
	h.calls.length = 0;
	await h.controller.checkNow();
	expect(h.calls).toEqual([]);
	expect(h.status.at(-1)?.text).toBe("1.8.0 will be installed on exit");
	expect(h.snap().phase).toBe("idle");
});

test("a skipped version offered manually stays skipped after 'Not now'", async () => {
	const h = make({ record: { skippedVersion: "1.8.0" } });
	await h.controller.checkNow();
	h.controller.notNow();
	expect(h.record().skippedVersion).toBe("1.8.0");
});

test("choosing to update a skipped version clears the skip", async () => {
	for (const choose of ["updateNow", "updateOnExit"] as const) {
		const h = make({ record: { skippedVersion: "1.8.0" } });
		await h.controller.checkNow();
		await h.controller[choose]();
		expect(h.record().skippedVersion).toBeNull();
	}
});

// --- unsaved work ---

test("'Update now' with unsaved work warns and starts nothing", async () => {
	const h = await offered({ unsaved: true });
	await h.controller.updateNow();
	expect(h.snap().phase).toBe("unsavedWarning");
	expect(h.snap().choiceIndex).toBe(0);
	expect(h.calls).toEqual([]);
});

test("'Go back' and Escape return to the offer", async () => {
	for (const back of ["goBack", "escape"] as const) {
		const h = await offered({ unsaved: true });
		await h.controller.updateNow();
		h.controller[back]();
		expect(h.snap().phase).toBe("offer");
		expect(h.calls).toEqual([]);
	}
});

test("'Save model first' proceeds only after a successful save", async () => {
	const ok = await offered({ unsaved: true });
	await ok.controller.updateNow();
	ok.controller.moveChoice(1);
	ok.controller.confirm();
	await tick();
	await tick();
	expect(ok.calls[0]).toBe("saveModel");
	expect(ok.calls).toContain("restart 1.8.0");

	const failed = await offered({ unsaved: true, saveModel: async () => false });
	await failed.controller.updateNow();
	await failed.controller.saveFirst();
	expect(failed.calls).toEqual(["saveModel"]);
	expect(failed.snap().phase).toBe("unsavedWarning");
	expect(failed.snap().warningError).toBe("The model could not be saved.");

	const threw = await offered({
		unsaved: true,
		saveModel: async () => {
			throw new Error("disk");
		},
	});
	await threw.controller.updateNow();
	await threw.controller.saveFirst();
	expect(threw.snap().phase).toBe("unsavedWarning");
});

test("'Update on exit instead' continues in the background", async () => {
	const h = await offered({ unsaved: true });
	await h.controller.updateNow();
	h.controller.moveChoice(2);
	h.controller.confirm();
	await tick();
	await tick();
	expect(h.snap().phase).toBe("idle");
	expect(h.snap().pendingStatus).toBe("ready");
	expect(h.calls.some((c) => c.startsWith("restart"))).toBe(false);
});

test("without unsaved work there is no warning", async () => {
	const h = await offered();
	await h.controller.updateNow();
	expect(h.calls).toContain("restart 1.8.0");
});

// --- an install the app cannot modify ---

test("a read-only install only gets a notice", async () => {
	const h = make({ availability: "read-only" });
	await h.controller.runStartupCheck(true);
	h.controller.openOffer();
	expect(h.snap().phase).toBe("notice");
	expect(h.snap().choiceIndex).toBe(0);

	h.calls.length = 0;
	await h.controller.updateNow();
	await h.controller.updateOnExit();
	expect(h.calls).toEqual([]);
	expect(h.snap().phase).toBe("notice");

	h.controller.confirm();
	expect(h.snap().phase).toBe("idle");
	expect(h.record().skippedVersion).toBeNull();
});

test("a read-only install can skip a version", async () => {
	const h = make({ availability: "read-only" });
	await h.controller.runStartupCheck(true);
	h.controller.openOffer();
	h.controller.moveChoice(1);
	h.controller.confirm();
	await tick();
	expect(h.record().skippedVersion).toBe("1.8.0");
	expect(h.calls).toEqual(["check"]);
});

// --- after an update ---

test("the first start after an update says so once", async () => {
	const h = make({ record: { installedFrom: "1.6.0" } });
	await h.controller.init();
	expect(h.status).toEqual([
		{
			text: "Updated to 1.7.0 (previous version kept as pairwise-tui.old)",
			error: false,
		},
	]);
	expect(h.record().installedFrom).toBeNull();
});

// --- quitting ---

test("quit work is needed only while downloading or with a verified update", async () => {
	const idle = make();
	await idle.controller.init();
	expect(idle.controller.needsQuitWork()).toBe(false);

	const held = heldDownload();
	const h = await offered({ download: held.download });
	const flow = h.controller.updateOnExit();
	await tick();
	expect(h.controller.needsQuitWork()).toBe(true);
	held.resolve();
	await flow;
	expect(h.controller.needsQuitWork()).toBe(true);
	await h.controller.finishOnQuit();
	expect(h.controller.needsQuitWork()).toBe(false);
});

// --- Options tab state line ---

function snapshotWith(over: Partial<UpdateSnapshot>): UpdateSnapshot {
	return { ...make().snap(), ...over };
}

function contextWith(availability: Availability): InstallContext {
	return {
		kind: "linux",
		targetPath: TARGET,
		assetName: "pairwise-tui",
		availability,
		identity: "1:2",
	};
}

test("the state line matches the contract texts", () => {
	const ok = contextWith("ok");
	expect(updateStateText(snapshotWith({ context: ok }))).toBeNull();
	expect(updateStateText(snapshotWith({ context: null }))).toBeNull();
	expect(
		updateStateText(
			snapshotWith({
				context: ok,
				pendingStatus: "downloading",
				pendingVersion: "1.8.0",
			}),
		),
	).toBe("Downloading 1.8.0, will install on exit");
	expect(
		updateStateText(
			snapshotWith({
				context: ok,
				pendingStatus: "ready",
				pendingVersion: "1.8.0",
			}),
		),
	).toBe("1.8.0 will be installed on exit");
	expect(
		updateStateText(snapshotWith({ context: contextWith("read-only") })),
	).toBe("Self-update unavailable: no write permission for the app's folder");
	expect(
		updateStateText(snapshotWith({ context: contextWith("source-run") })),
	).toBe("Updates unavailable when running from source");
	expect(
		updateStateText(
			snapshotWith({ context: contextWith("unsupported-platform") }),
		),
	).toBe("Updates unavailable on this platform");
	expect(
		updateStateText(snapshotWith({ context: ok, lastCheckError: "HTTP 403" })),
	).toBe("Last update check failed: HTTP 403");
});

test("updates are available only for installs that can check", () => {
	expect(updatesAvailable(snapshotWith({ context: null }))).toBe(false);
	expect(updatesAvailable(snapshotWith({ context: contextWith("ok") }))).toBe(
		true,
	);
	expect(
		updatesAvailable(snapshotWith({ context: contextWith("read-only") })),
	).toBe(true);
	expect(
		updatesAvailable(snapshotWith({ context: contextWith("source-run") })),
	).toBe(false);
});
