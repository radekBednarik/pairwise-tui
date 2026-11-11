import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import * as nodeFs from "node:fs/promises";
import { mkdtemp, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UpdateError } from "./errors";
import {
	acquireLock,
	cleanupLeftovers,
	type InstallFs,
	installUpdate,
	releaseLock,
} from "./install";
import { fileIdentity } from "./platform";
import { EMPTY_UPDATE_RECORD, type UpdateRecord } from "./state";

const OLD = "old program";
const NEW = "new program, longer";
const NEW_SHA = createHash("sha256").update(NEW).digest("hex");
const POSIX = process.platform !== "win32";

let dir: string;
let target: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-update-install-"));
	target = join(dir, "pairwise-tui");
	await Bun.write(target, OLD);
	await nodeFs.chmod(target, 0o755);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function stage(content = NEW): Promise<void> {
	await Bun.write(`${target}.new`, content);
	await nodeFs.chmod(`${target}.new`, 0o600);
}

async function text(path: string): Promise<string> {
	return Bun.file(path).text();
}

async function mode(path: string): Promise<number> {
	return (await stat(path)).mode & 0o777;
}

async function kind(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (e) {
		return e instanceof UpdateError ? e.kind : `not UpdateError: ${e}`;
	}
	return "resolved";
}

async function install(over: Record<string, unknown> = {}) {
	return installUpdate({
		target,
		expectedSha256: NEW_SHA,
		identity: await fileIdentity(target),
		kind: "linux",
		...over,
	});
}

/** Real fs with selected calls replaced, plus a log of what was called. */
function spyFs(over: Partial<InstallFs> = {}) {
	const calls: string[] = [];
	const real: InstallFs = {
		rename: nodeFs.rename,
		link: nodeFs.link,
		copyFile: nodeFs.copyFile,
		unlink: nodeFs.unlink,
		chmod: nodeFs.chmod,
	};
	const short = (arg: unknown) => String(arg).replace(`${dir}/`, "");
	const wrap = <K extends keyof InstallFs>(name: K): InstallFs[K] =>
		(async (...args: unknown[]) => {
			calls.push(`${name} ${args.map(short).join(" ")}`);
			const impl = (over[name] ?? real[name]) as (
				...a: unknown[]
			) => Promise<void>;
			return impl(...args);
		}) as InstallFs[K];
	const fs: InstallFs = {
		rename: wrap("rename"),
		link: wrap("link"),
		copyFile: wrap("copyFile"),
		unlink: wrap("unlink"),
		chmod: wrap("chmod"),
	};
	return { fs, calls };
}

// --- lock ---

test("the lock is exclusive and released explicitly", async () => {
	expect(await acquireLock(target)).toBe(true);
	const content = JSON.parse(await text(`${target}.update.lock`));
	expect(content.pid).toBe(process.pid);
	expect(typeof content.at).toBe("string");
	expect(await acquireLock(target)).toBe(false);
	await releaseLock(target);
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
	expect(await acquireLock(target)).toBe(true);
});

test("a live owner keeps its lock even after an hour", async () => {
	const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({ pid: 4242, at: twoHoursAgo.toISOString() }),
	);
	expect(await acquireLock(target, { isAlive: () => true })).toBe(false);
});

test("a lock whose owner is dead is replaced", async () => {
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({ pid: 4242, at: new Date().toISOString() }),
	);
	expect(await acquireLock(target, { isAlive: () => false })).toBe(true);
	expect(JSON.parse(await text(`${target}.update.lock`)).pid).toBe(process.pid);
});

test("an unreadable lock is replaced only when older than an hour", async () => {
	const lock = `${target}.update.lock`;
	await Bun.write(lock, "garbage");
	expect(await acquireLock(target)).toBe(false);
	const old = new Date(Date.now() - 2 * 3600_000);
	await utimes(lock, old, old);
	expect(await acquireLock(target)).toBe(true);
});

test("unknown liveness falls back to the lock's age", async () => {
	const lock = `${target}.update.lock`;
	const write = (ageMs: number) =>
		Bun.write(
			lock,
			JSON.stringify({
				pid: 4242,
				at: new Date(Date.now() - ageMs).toISOString(),
			}),
		);
	await write(10 * 60_000);
	expect(await acquireLock(target, { isAlive: () => null })).toBe(false);
	await write(2 * 3600_000);
	expect(await acquireLock(target, { isAlive: () => null })).toBe(true);
});

test("a lock older than a day is stale even with a live pid", async () => {
	// A pid can be reused by an unrelated process, above all after a reboot.
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({
			pid: 4242,
			at: new Date(Date.now() - 25 * 3600_000).toISOString(),
		}),
	);
	expect(await acquireLock(target, { isAlive: () => true })).toBe(true);
});

// --- install: checks shared by both paths ---

test("a staged file that changed after verification is refused", async () => {
	await stage("tampered");
	expect(await kind(install())).toBe("verify-failed");
	expect(await text(target)).toBe(OLD);
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("a missing staged file is refused", async () => {
	expect(await kind(install())).toBe("verify-failed");
	expect(await text(target)).toBe(OLD);
});

test("a target that was moved or replaced since startup is refused", async () => {
	await stage();
	const identity = await fileIdentity(target);
	await Bun.write(join(dir, "other"), OLD);
	await nodeFs.rename(join(dir, "other"), target);
	expect(await kind(install({ identity }))).toBe("moved");
	expect(await text(target)).toBe(OLD);
	expect(await text(`${target}.new`)).toBe(NEW);
});

test("an unknown identity is refused", async () => {
	await stage();
	expect(await kind(install({ identity: null }))).toBe("moved");
});

// --- install: linux and appimage path ---

for (const k of ["linux", "appimage"] as const) {
	test(`${k}: replaces the target in one rename and keeps one backup`, async () => {
		await stage();
		await Bun.write(`${target}.old`, "older backup");
		const { fs, calls } = spyFs();
		await install({ kind: k, fs });

		expect(await text(target)).toBe(NEW);
		expect(await text(`${target}.old`)).toBe(OLD);
		expect((await readdir(dir)).sort()).toEqual([
			"pairwise-tui",
			"pairwise-tui.old",
		]);
		if (POSIX) expect(await mode(target)).toBe(0o755);

		const renames = calls.filter((c) => c.startsWith("rename "));
		expect(renames).toEqual(["rename pairwise-tui.new pairwise-tui"]);
		// The target is never renamed away: a file exists there throughout.
		expect(calls.some((c) => c.startsWith("rename pairwise-tui "))).toBe(false);
	});
}

test("linux: falls back to a copy when hard links are not possible", async () => {
	await stage();
	const { fs, calls } = spyFs({
		link: async () => {
			throw Object.assign(new Error("EPERM"), { code: "EPERM" });
		},
	});
	await install({ fs });
	expect(await text(target)).toBe(NEW);
	expect(await text(`${target}.old`)).toBe(OLD);
	expect(calls.some((c) => c.startsWith("copyFile pairwise-tui "))).toBe(true);
});

test("linux: a failing rename leaves the complete old program in place", async () => {
	await stage();
	const { fs } = spyFs({
		rename: async () => {
			throw Object.assign(new Error("EIO"), { code: "EIO" });
		},
	});
	expect(await kind(install({ fs }))).toBe("storage");
	expect(await text(target)).toBe(OLD);
	if (POSIX) expect(await mode(target)).toBe(0o755);
});

test("linux: a failing backup leaves the target untouched", async () => {
	await stage();
	const fail = async () => {
		throw Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });
	};
	const { fs } = spyFs({ link: fail, copyFile: fail });
	expect(await kind(install({ fs }))).toBe("storage");
	expect(await text(target)).toBe(OLD);
});

test("linux: a kill between backup and rename leaves a startable program", async () => {
	await stage();
	const killed = new Error("simulated kill");
	const p = install({
		afterBackup: () => {
			throw killed;
		},
	});
	await expect(p).rejects.toBe(killed);
	expect(await text(target)).toBe(OLD);
	if (POSIX) expect(await mode(target)).toBe(0o755);
	expect(await text(`${target}.old`)).toBe(OLD);
});

// --- install: windows path (selected by parameter, so it runs anywhere) ---

test("windows: renames the target away, then the new file in", async () => {
	await stage();
	await Bun.write(`${target}.old`, "older backup");
	const { fs, calls } = spyFs();
	await install({ kind: "windows", fs });

	expect(await text(target)).toBe(NEW);
	expect(await text(`${target}.old`)).toBe(OLD);
	expect((await readdir(dir)).sort()).toEqual([
		"pairwise-tui",
		"pairwise-tui.old",
	]);
	expect(calls.filter((c) => c.startsWith("rename "))).toEqual([
		"rename pairwise-tui pairwise-tui.old",
		"rename pairwise-tui.new pairwise-tui",
	]);
	expect(calls.some((c) => c.startsWith("chmod "))).toBe(false);
});

test("windows: a failing second rename puts the old program back", async () => {
	await stage();
	let n = 0;
	const { fs } = spyFs({
		rename: async (from, to) => {
			n++;
			if (n === 2) throw Object.assign(new Error("EPERM"), { code: "EPERM" });
			return nodeFs.rename(from, to);
		},
	});
	expect(await kind(install({ kind: "windows", fs }))).toBe("storage");
	expect(await text(target)).toBe(OLD);
});

test("windows: a failing first rename leaves the target untouched", async () => {
	await stage();
	const { fs } = spyFs({
		rename: async () => {
			throw Object.assign(new Error("EPERM"), { code: "EPERM" });
		},
	});
	expect(await kind(install({ kind: "windows", fs }))).toBe("storage");
	expect(await text(target)).toBe(OLD);
});

test("windows: a locked previous backup is refused with the target untouched", async () => {
	await stage();
	await Bun.write(`${target}.old`, "locked backup");
	const { fs, calls } = spyFs({
		unlink: async () => {
			throw Object.assign(new Error("EPERM"), { code: "EPERM" });
		},
	});
	expect(await kind(install({ kind: "windows", fs }))).toBe("locked");
	expect(await text(target)).toBe(OLD);
	expect(calls.some((c) => c.startsWith("rename "))).toBe(false);
});

// --- cleanup ---

function record(over: Partial<UpdateRecord> = {}): UpdateRecord {
	return { ...EMPTY_UPDATE_RECORD, ...over };
}

test("cleanup removes partial and orphan staged files, never the backup", async () => {
	await Bun.write(`${target}.part`, "p");
	await Bun.write(`${target}.new`, "n");
	await Bun.write(`${target}.old`, "o");
	expect(await cleanupLeftovers({ target, record: record() })).toBe(true);
	expect((await readdir(dir)).sort()).toEqual([
		"pairwise-tui",
		"pairwise-tui.old",
	]);
});

test("cleanup keeps a staged file that a verified pending update points to", async () => {
	await Bun.write(`${target}.part`, "p");
	await stage();
	const pending = {
		version: "1.8.0",
		mode: "onExit" as const,
		sha256: NEW_SHA,
		targetPath: target,
	};
	await cleanupLeftovers({ target, record: record({ pending }) });
	expect((await readdir(dir)).sort()).toEqual([
		"pairwise-tui",
		"pairwise-tui.new",
	]);
});

test("cleanup removes a staged file when pending is unverified or for another target", async () => {
	for (const pending of [
		{
			version: "1.8.0",
			mode: "onExit" as const,
			sha256: null,
			targetPath: target,
		},
		{
			version: "1.8.0",
			mode: "onExit" as const,
			sha256: NEW_SHA,
			targetPath: "/elsewhere/pairwise-tui",
		},
	]) {
		await stage();
		await cleanupLeftovers({ target, record: record({ pending }) });
		expect(await readdir(dir)).toEqual(["pairwise-tui"]);
	}
});

test("cleanup removes a stale lock", async () => {
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({ pid: 4242, at: new Date().toISOString() }),
	);
	await cleanupLeftovers({ target, record: record(), isAlive: () => false });
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("cleanup touches nothing while another live copy holds the lock", async () => {
	await Bun.write(`${target}.part`, "being downloaded");
	await Bun.write(
		`${target}.update.lock`,
		JSON.stringify({ pid: 4242, at: new Date().toISOString() }),
	);
	expect(
		await cleanupLeftovers({ target, record: record(), isAlive: () => true }),
	).toBe(false);
	expect((await readdir(dir)).sort()).toEqual([
		"pairwise-tui",
		"pairwise-tui.part",
		"pairwise-tui.update.lock",
	]);
});
