import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	EMPTY_UPDATE_RECORD,
	loadUpdateRecord,
	RELEASES_PAGE_URL,
	saveUpdateRecord,
	type UpdateRecord,
} from "./state";

let dir: string;
let path: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-update-state-"));
	path = join(dir, "nested", "update.json");
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const SHA = "a".repeat(64);

const available = {
	version: "1.8.0",
	tag: "v1.8.0",
	notes: "Notes",
	pageUrl: "https://github.com/radekBednarik/pairwise-tui/releases/tag/v1.8.0",
	assetName: "pairwise-tui",
	sizeBytes: 1000,
};

const full: UpdateRecord = {
	lastCheckAt: "2026-11-11T10:00:00.000Z",
	lastAttemptAt: "2026-11-11T11:00:00.000Z",
	available,
	skippedVersion: "1.7.5",
	pending: {
		version: "1.8.0",
		mode: "onExit",
		sha256: SHA,
		targetPath: "/opt/pairwise-tui",
	},
	installedFrom: "1.7.0",
};

async function loadRaw(raw: unknown): Promise<UpdateRecord> {
	await Bun.write(path, typeof raw === "string" ? raw : JSON.stringify(raw));
	return loadUpdateRecord(path);
}

test("a missing file gives the empty record", async () => {
	expect(await loadUpdateRecord(path)).toEqual(EMPTY_UPDATE_RECORD);
	expect(EMPTY_UPDATE_RECORD).toEqual({
		lastCheckAt: null,
		lastAttemptAt: null,
		available: null,
		skippedVersion: null,
		pending: null,
		installedFrom: null,
	});
});

test("a corrupt file gives the empty record", async () => {
	expect(await loadRaw("{not json")).toEqual(EMPTY_UPDATE_RECORD);
	expect(await loadRaw("[1,2]")).toEqual(EMPTY_UPDATE_RECORD);
	expect(await loadRaw("null")).toEqual(EMPTY_UPDATE_RECORD);
});

test("a full record round-trips and save creates the directory", async () => {
	await saveUpdateRecord(full, path);
	expect(await loadUpdateRecord(path)).toEqual(full);
});

test("timestamps that do not parse become null", async () => {
	const r = await loadRaw({
		...full,
		lastCheckAt: "yesterday-ish",
		lastAttemptAt: 12345,
	});
	expect(r.lastCheckAt).toBeNull();
	expect(r.lastAttemptAt).toBeNull();
});

test("invalid versions in skippedVersion and installedFrom become null", async () => {
	const r = await loadRaw({
		...full,
		skippedVersion: "1.8",
		installedFrom: { v: 1 },
	});
	expect(r.skippedVersion).toBeNull();
	expect(r.installedFrom).toBeNull();
});

test("available is dropped when any required field is invalid", async () => {
	const broken = [
		{ ...available, version: "one" },
		{ ...available, tag: "v9.9.9" },
		{ ...available, tag: "1.8.0" },
		{ ...available, notes: 5 },
		{ ...available, assetName: "" },
		{ ...available, sizeBytes: 0 },
		{ ...available, sizeBytes: 1.5 },
		{ ...available, sizeBytes: "1000" },
		"nope",
	];
	for (const a of broken) {
		expect((await loadRaw({ ...full, available: a })).available).toBeNull();
	}
});

test("available notes are truncated to 20 000 characters", async () => {
	const r = await loadRaw({
		...full,
		available: { ...available, notes: "x".repeat(25_000) },
	});
	expect(r.available?.notes.length).toBe(20_000);
});

test("a page URL outside the project's releases is replaced", async () => {
	for (const pageUrl of [
		"https://evil.example/releases",
		"http://github.com/radekBednarik/pairwise-tui/releases/tag/v1.8.0",
		"https://github.com/radekBednarik/pairwise-tui/releasesX",
		42,
	]) {
		const r = await loadRaw({ ...full, available: { ...available, pageUrl } });
		expect(r.available?.pageUrl).toBe(RELEASES_PAGE_URL);
	}
	expect(RELEASES_PAGE_URL).toBe(
		"https://github.com/radekBednarik/pairwise-tui/releases",
	);
});

test("pending is dropped when any field is invalid", async () => {
	const p = full.pending;
	const broken = [
		{ ...p, version: "x" },
		{ ...p, mode: "later" },
		{ ...p, sha256: "abc" },
		{ ...p, sha256: "A".repeat(64) },
		{ ...p, sha256: "g".repeat(64) },
		{ ...p, targetPath: 7 },
		{ ...p, targetPath: "" },
		[],
	];
	for (const pending of broken) {
		expect((await loadRaw({ ...full, pending })).pending).toBeNull();
	}
});

test("pending accepts a null sha256 and both modes", async () => {
	const r = await loadRaw({
		...full,
		pending: { ...full.pending, mode: "now", sha256: null },
	});
	expect(r.pending).toEqual({
		version: "1.8.0",
		mode: "now",
		sha256: null,
		targetPath: "/opt/pairwise-tui",
	});
});

test("unknown fields are dropped on save", async () => {
	const withExtra = {
		...full,
		extra: "x",
		available: { ...available, sneaky: 1 },
	} as unknown as UpdateRecord;
	await saveUpdateRecord(withExtra, path);
	const onDisk = JSON.parse(await Bun.file(path).text());
	expect(onDisk.extra).toBeUndefined();
	expect(onDisk.available.sneaky).toBeUndefined();
	expect(Object.keys(onDisk).sort()).toEqual(
		Object.keys(EMPTY_UPDATE_RECORD).sort(),
	);
});

// --- review round 1 ---

test("notes read back from the file are sanitized again", async () => {
	const r = await loadRaw({
		...full,
		available: { ...available, notes: "ok\x1b[31mred\u202Etxt" },
	});
	expect(r.available?.notes).toBe("ok[31mredtxt");
});

test("an implausibly large artifact in the file is dropped", async () => {
	const r = await loadRaw({
		...full,
		available: { ...available, sizeBytes: 600 * 1024 * 1024 },
	});
	expect(r.available).toBeNull();
});

test("an oversized record file is treated as empty", async () => {
	await Bun.write(path, JSON.stringify({ ...full, junk: "x".repeat(400_000) }));
	expect(await loadUpdateRecord(path)).toEqual(EMPTY_UPDATE_RECORD);
});

test.skipIf(process.platform === "win32")(
	"a record path that is not a regular file is treated as empty, without blocking",
	async () => {
		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(dir, "nested"), { recursive: true });
		Bun.spawnSync(["mkfifo", path]);
		const result = await Promise.race([
			loadUpdateRecord(path),
			new Promise<string>((r) => setTimeout(() => r("blocked"), 1500)),
		]);
		expect(result).toEqual(EMPTY_UPDATE_RECORD);
	},
);
