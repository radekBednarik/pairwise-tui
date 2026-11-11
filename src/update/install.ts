import { constants as fsConstants } from "node:fs";
import * as nodeFs from "node:fs/promises";
import { errorMessage, UpdateError } from "./errors";
import { fileIdentity, type InstallKind } from "./platform";
import type { UpdateRecord } from "./state";

export interface InstallFs {
	rename(from: string, to: string): Promise<void>;
	link(existing: string, created: string): Promise<void>;
	copyFile(from: string, to: string, mode?: number): Promise<void>;
	unlink(path: string): Promise<void>;
	chmod(path: string, mode: number): Promise<void>;
}

const REAL_FS: InstallFs = {
	rename: nodeFs.rename,
	link: nodeFs.link,
	copyFile: nodeFs.copyFile,
	unlink: nodeFs.unlink,
	chmod: nodeFs.chmod,
};

const HOUR_MS = 3600_000;
/** Liveness unknown: fall back to age. */
const UNKNOWN_OWNER_STALE_MS = HOUR_MS;
/**
 * A pid can be reused by an unrelated process, above all after a reboot, and
 * would then keep a dead lock "alive" forever. No download takes a day.
 */
const ANY_OWNER_STALE_MS = 24 * HOUR_MS;
/** A lock dated this far ahead of the clock was not written by a sane run. */
const FUTURE_TOLERANCE_MS = 60_000;
/** The lock is two short fields; anything bigger is not ours. */
const MAX_LOCK_BYTES = 4096;
/** How long a crashed takeover may block the next one. */
const TAKEOVER_STALE_MS = 30_000;

export const partPath = (target: string) => `${target}.part`;
export const stagedPath = (target: string) => `${target}.new`;
export const backupPath = (target: string) => `${target}.old`;
export const lockPath = (target: string) => `${target}.update.lock`;

function code(err: unknown): string | undefined {
	return (err as NodeJS.ErrnoException | null)?.code;
}

/** true = alive, false = gone, null = cannot tell. */
export type IsAlive = (pid: number) => boolean | null;

const defaultIsAlive: IsAlive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		if (code(err) === "ESRCH") return false;
		// Exists, but belongs to another user.
		if (code(err) === "EPERM") return true;
		return null;
	}
};

export interface LockOptions {
	isAlive?: IsAlive;
	now?: () => number;
}

interface LockOwner {
	pid: number;
	at: number;
}

/** The lock's owner, or null when the file is not a readable lock of ours. */
async function readLockOwner(path: string): Promise<LockOwner | null> {
	try {
		// A regular, small file only: reading a FIFO planted here would block.
		const info = await nodeFs.stat(path);
		if (!info.isFile() || info.size > MAX_LOCK_BYTES) return null;
		const parsed = JSON.parse(await Bun.file(path).text());
		const at = Date.parse(parsed?.at);
		if (Number.isInteger(parsed?.pid) && !Number.isNaN(at)) {
			return { pid: parsed.pid, at };
		}
	} catch {
		// Unreadable: the caller decides by the file's age.
	}
	return null;
}

async function lockIsStale(
	path: string,
	isAlive: IsAlive,
	now: number,
): Promise<boolean> {
	const owner = await readLockOwner(path);
	if (!owner) {
		try {
			const info = await nodeFs.stat(path);
			// Not a file at all (a FIFO, a directory): never a lock of ours.
			if (!info.isFile()) return true;
			return now - info.mtimeMs > UNKNOWN_OWNER_STALE_MS;
		} catch {
			// Gone in the meantime: nothing in the way any more.
			return true;
		}
	}
	const age = now - owner.at;
	if (age > ANY_OWNER_STALE_MS || age < -FUTURE_TOLERANCE_MS) return true;
	const alive = isAlive(owner.pid);
	if (alive === null) return age > UNKNOWN_OWNER_STALE_MS;
	return !alive;
}

async function createLock(path: string, now: number): Promise<boolean> {
	try {
		const handle = await nodeFs.open(path, "wx", 0o600);
		try {
			await handle.writeFile(
				JSON.stringify({ pid: process.pid, at: new Date(now).toISOString() }),
			);
		} finally {
			await handle.close();
		}
		return true;
	} catch {
		return false;
	}
}

async function removeAny(path: string): Promise<void> {
	await nodeFs.rm(path, { force: true, recursive: true }).catch(() => {});
}

/**
 * Takes the per-install update lock. Only one copy of the app downloads or
 * installs at a time; the others carry on with the version they run.
 *
 * Replacing a stale lock is itself guarded by a short-lived second file.
 * Without it, two copies that both judge the lock stale could each delete
 * "the stale lock" and create their own, the second deleting the first's
 * fresh one, and both would believe they hold it. With it, exactly one copy
 * removes and replaces; the others simply do not get the lock this time.
 */
export async function acquireLock(
	target: string,
	options: LockOptions = {},
): Promise<boolean> {
	const path = lockPath(target);
	const isAlive = options.isAlive ?? defaultIsAlive;
	const now = (options.now ?? Date.now)();

	if (await createLock(path, now)) return true;
	if (!(await lockIsStale(path, isAlive, now))) return false;

	const takeover = `${path}.takeover`;
	let guard: nodeFs.FileHandle;
	try {
		guard = await nodeFs.open(takeover, "wx", 0o600);
	} catch {
		// Someone else is replacing the lock right now. A guard left by a
		// crash in that short window is cleared for the next attempt.
		try {
			const info = await nodeFs.stat(takeover);
			if (now - info.mtimeMs > TAKEOVER_STALE_MS) await removeAny(takeover);
		} catch {
			// Already gone.
		}
		return false;
	}
	try {
		// Judged again under the guard: the lock seen as stale above may have
		// been replaced by a live one since.
		if (!(await lockIsStale(path, isAlive, now))) return false;
		await removeAny(path);
		return await createLock(path, now);
	} finally {
		await guard.close().catch(() => {});
		await nodeFs.unlink(takeover).catch(() => {});
	}
}

/** Releases the lock, but only if this process is the one holding it. */
export async function releaseLock(target: string): Promise<void> {
	const path = lockPath(target);
	const owner = await readLockOwner(path);
	if (owner?.pid !== process.pid) return;
	await nodeFs.unlink(path).catch(() => {});
}

export async function hashFile(path: string): Promise<string | null> {
	try {
		const hasher = new Bun.CryptoHasher("sha256");
		const reader = Bun.file(path).stream().getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			hasher.update(value);
		}
		return hasher.digest("hex");
	} catch {
		return null;
	}
}

export interface InstallOptions {
	/** The app file to replace. */
	target: string;
	/** Hash recorded when the staged file was verified. */
	expectedSha256: string;
	/** Identity of `target` at startup (see platform.ts). */
	identity: string | null;
	kind: InstallKind;
	fs?: Partial<InstallFs>;
	/** Test hook: runs after the backup exists, before the target is replaced. */
	afterBackup?: () => void;
}

async function step<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (err) {
		throw new UpdateError("storage", errorMessage(err));
	}
}

/**
 * Replaces the app file with the verified `<target>.new`, keeping the old
 * program as `<target>.old`.
 *
 * Linux and AppImage: the backup is a hard link (a copy where links are not
 * possible) and the new file is renamed **over** the target. POSIX rename
 * onto an existing file is atomic, also when that file is running, so a
 * complete program exists at the target at every instant.
 *
 * Windows forbids overwriting or renaming over a running program but allows
 * renaming it away, so there the target is renamed to the backup name first
 * and the new file renamed in second. An interruption exactly between the two
 * leaves the old program under the backup name (documented restore).
 */
export async function installUpdate(options: InstallOptions): Promise<void> {
	const { target, kind } = options;
	// Partial replacements are allowed: the rest stays the real file system.
	const fs: InstallFs = { ...REAL_FS, ...options.fs };
	const staged = stagedPath(target);
	const backup = backupPath(target);

	// The staged file may have waited since an earlier run: verify it again
	// right before it becomes the program.
	const actual = await hashFile(staged);
	if (actual === null || actual !== options.expectedSha256) {
		await fs.unlink(staged).catch(() => {});
		throw new UpdateError(
			"verify-failed",
			"the downloaded update is missing or was changed",
		);
	}

	const identity = await fileIdentity(target);
	if (options.identity === null || identity !== options.identity) {
		throw new UpdateError(
			"moved",
			"the app file was moved or replaced since it started",
		);
	}

	if (kind === "windows") {
		try {
			await fs.unlink(backup);
		} catch (err) {
			if (code(err) !== "ENOENT") {
				throw new UpdateError(
					"locked",
					"the previous version is still in use by a running copy; close it and try again",
				);
			}
		}
		await step(() => fs.rename(target, backup));
		options.afterBackup?.();
		try {
			await fs.rename(staged, target);
		} catch (err) {
			await fs.rename(backup, target).catch(() => {});
			throw new UpdateError("storage", errorMessage(err));
		}
		return;
	}

	await step(() => fs.chmod(staged, 0o755));
	// The old backup must really be gone before a new one is made. If it
	// cannot be removed, something else owns that path: stop, rather than
	// write to whatever is there.
	try {
		await fs.unlink(backup);
	} catch (err) {
		if (code(err) !== "ENOENT") {
			throw new UpdateError(
				"storage",
				`the previous backup could not be removed: ${errorMessage(err)}`,
			);
		}
	}
	try {
		await fs.link(target, backup);
	} catch {
		// COPYFILE_EXCL: fail if anything appeared at the backup path in the
		// meantime, instead of following a link planted there.
		await step(() => fs.copyFile(target, backup, fsConstants.COPYFILE_EXCL));
	}
	options.afterBackup?.();
	await step(() => fs.rename(staged, target));
}

export interface CleanupOptions extends LockOptions {
	target: string;
	record: UpdateRecord;
}

/**
 * Removes what an interrupted update left beside the app: the partial
 * download, a staged file nothing points to, a stale lock. The backup is
 * never touched. Does nothing, and returns false, while another live copy
 * holds the lock: its files are in use.
 */
export async function cleanupLeftovers(
	options: CleanupOptions,
): Promise<boolean> {
	const { target, record } = options;
	if (!(await acquireLock(target, options))) return false;
	try {
		await nodeFs.unlink(partPath(target)).catch(() => {});
		const keepStaged =
			record.pending !== null &&
			record.pending.sha256 !== null &&
			record.pending.targetPath === target;
		if (!keepStaged) await nodeFs.unlink(stagedPath(target)).catch(() => {});
	} finally {
		await releaseLock(target);
	}
	return true;
}
