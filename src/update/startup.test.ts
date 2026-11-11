import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileIdentity, type InstallContext } from "./platform";
import { runStartupTasks } from "./startup";
import {
	type AvailableUpdate,
	EMPTY_UPDATE_RECORD,
	loadUpdateRecord,
	type PendingUpdate,
	saveUpdateRecord,
	type UpdateRecord,
} from "./state";

const OLD = "old program";
const NEW = "new program";
const NEW_SHA = createHash("sha256").update(NEW).digest("hex");
const POSIX = process.platform !== "win32";

let dir: string;
let target: string;
let recordPath: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-update-startup-"));
	target = join(dir, "pairwise-tui");
	recordPath = join(dir, "config", "update.json");
	await Bun.write(target, OLD);
	await chmod(target, 0o755);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function context(
	over: Partial<InstallContext> = {},
): Promise<InstallContext> {
	return {
		kind: "linux",
		targetPath: target,
		assetName: "pairwise-tui",
		availability: "ok",
		identity: await fileIdentity(target),
		...over,
	};
}

function available(version: string): AvailableUpdate {
	return {
		version,
		tag: `v${version}`,
		notes: "",
		pageUrl: "https://github.com/radekBednarik/pairwise-tui/releases",
		assetName: "pairwise-tui",
		sizeBytes: 10,
	};
}

function pending(over: Partial<PendingUpdate> = {}): PendingUpdate {
	return {
		version: "1.8.0",
		mode: "onExit",
		sha256: NEW_SHA,
		targetPath: target,
		...over,
	};
}

async function seed(over: Partial<UpdateRecord>): Promise<void> {
	await saveUpdateRecord({ ...EMPTY_UPDATE_RECORD, ...over }, recordPath);
}

async function run(over: Partial<InstallContext> = {}, extra = {}) {
	return runStartupTasks({
		context: await context(over),
		installedVersion: "1.7.0",
		recordPath,
		...extra,
	});
}

async function files(): Promise<string[]> {
	return (await readdir(dir)).filter((f) => f !== "config").sort();
}

// --- cleanup ---

test("removes a partial download, an orphan staged file and a stale lock", async () => {
	await Bun.write(`${target}.part`, "p");
	await Bun.write(`${target}.new`, "n");
	await Bun.write(`${target}.old`, "o");
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({ pid: 4242, at: new Date().toISOString() }),
	);
	const result = await run({}, { isAlive: () => false });
	expect(result.restartVersion).toBeNull();
	expect(await files()).toEqual(["pairwise-tui", "pairwise-tui.old"]);
});

test("drops a cached update that is not newer than the installed version", async () => {
	await seed({ available: available("1.7.0") });
	await run();
	expect((await loadUpdateRecord(recordPath)).available).toBeNull();

	await seed({ available: available("1.8.0") });
	await run();
	expect((await loadUpdateRecord(recordPath)).available?.version).toBe("1.8.0");
});

test("drops a pending update for another target, without a hash, or without its file", async () => {
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending({ targetPath: "/elsewhere/pairwise-tui" }) });
	expect((await run()).restartVersion).toBeNull();
	expect((await loadUpdateRecord(recordPath)).pending).toBeNull();
	expect(await files()).toEqual(["pairwise-tui"]);

	// Killed while downloading: nothing verified to install.
	await Bun.write(`${target}.part`, "half");
	await seed({ pending: pending({ sha256: null }) });
	expect((await run()).restartVersion).toBeNull();
	expect((await loadUpdateRecord(recordPath)).pending).toBeNull();
	expect(await files()).toEqual(["pairwise-tui"]);

	await seed({ pending: pending() });
	expect((await run()).restartVersion).toBeNull();
	expect((await loadUpdateRecord(recordPath)).pending).toBeNull();
	expect(await Bun.file(target).text()).toBe(OLD);
});

test("drops a pending update that is not newer than the installed version", async () => {
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending({ version: "1.7.0" }) });
	expect((await run()).restartVersion).toBeNull();
	expect((await loadUpdateRecord(recordPath)).pending).toBeNull();
	expect(await files()).toEqual(["pairwise-tui"]);
});

test("does nothing for installs that cannot update themselves", async () => {
	await Bun.write(`${target}.part`, "p");
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending() });
	for (const availability of [
		"source-run",
		"unsupported-platform",
		"read-only",
	] as const) {
		const result = await run({ availability });
		expect(result.restartVersion).toBeNull();
	}
	expect(await files()).toEqual([
		"pairwise-tui",
		"pairwise-tui.new",
		"pairwise-tui.part",
	]);
	expect(await Bun.file(target).text()).toBe(OLD);
});

test("never throws: an internal failure comes back as a reason", async () => {
	const result = await runStartupTasks({
		context: await context(),
		installedVersion: "1.7.0",
		recordPath,
		loadRecord: async () => {
			throw new Error("disk on fire");
		},
	});
	expect(result.restartVersion).toBeNull();
	expect(result.reason).toContain("disk on fire");
});

// --- finishing an update the user agreed to ---

test("installs a verified pending update and asks for a restart", async () => {
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending(), available: available("1.8.0") });

	const result = await run();

	expect(result.restartVersion).toBe("1.8.0");
	expect(await Bun.file(target).text()).toBe(NEW);
	if (POSIX) expect((await stat(target)).mode & 0o777).toBe(0o755);
	expect(await Bun.file(`${target}.old`).text()).toBe(OLD);
	expect(await files()).toEqual(["pairwise-tui", "pairwise-tui.old"]);
	const record = await loadUpdateRecord(recordPath);
	expect(record.pending).toBeNull();
	expect(record.installedFrom).toBe("1.7.0");
});

test("an update agreed to with 'Update now' is finished the same way", async () => {
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending({ mode: "now" }) });
	expect((await run()).restartVersion).toBe("1.8.0");
	expect(await Bun.file(target).text()).toBe(NEW);
});

test("a staged file that no longer matches its hash is discarded", async () => {
	await Bun.write(`${target}.new`, "tampered");
	await seed({ pending: pending() });

	const result = await run();

	expect(result.restartVersion).toBeNull();
	expect(await Bun.file(target).text()).toBe(OLD);
	expect(await files()).toEqual(["pairwise-tui"]);
	const record = await loadUpdateRecord(recordPath);
	expect(record.pending).toBeNull();
	expect(record.installedFrom).toBeNull();
});

test("leaves everything for later while another live copy holds the lock", async () => {
	await Bun.write(`${target}.new`, NEW);
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({ pid: 4242, at: new Date().toISOString() }),
	);
	await seed({ pending: pending() });

	const result = await run({}, { isAlive: () => true });

	expect(result.restartVersion).toBeNull();
	expect(result.reason).toContain("another copy");
	expect(await Bun.file(target).text()).toBe(OLD);
	expect(await files()).toEqual([
		"pairwise-tui",
		"pairwise-tui.new",
		"pairwise-tui.update.lock",
	]);
	expect((await loadUpdateRecord(recordPath)).pending).toEqual(pending());
});

test("a target replaced since the update was staged keeps the old program", async () => {
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending() });
	// Identity recorded for some other file: the install must refuse.
	const result = await run({ identity: "0:0" });
	expect(result.restartVersion).toBeNull();
	expect(await Bun.file(target).text()).toBe(OLD);
});

// --- review round 1 ---

test("an install refused because the backup is in use is not retried at every start", async () => {
	await Bun.write(`${target}.new`, NEW);
	await seed({ pending: pending(), available: available("1.8.0") });
	const result = await runStartupTasks({
		context: await context({ kind: "windows" }),
		installedVersion: "1.7.0",
		recordPath,
		installFs: {
			unlink: async () => {
				throw Object.assign(new Error("EPERM"), { code: "EPERM" });
			},
		},
	});
	expect(result.restartVersion).toBeNull();
	expect(result.reason).toContain("still in use");
	const record = await loadUpdateRecord(recordPath);
	expect(record.pending).toBeNull();
	// Still known, so it is offered again instead of failing silently forever.
	expect(record.available?.version).toBe("1.8.0");
	expect(await Bun.file(target).text()).toBe(OLD);
});
