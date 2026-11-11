import { unlink } from "node:fs/promises";
import { errorMessage, UpdateError } from "./errors";
import {
	acquireLock,
	type IsAlive,
	installUpdate,
	partPath,
	releaseLock,
	stagedPath,
} from "./install";
import type { InstallContext } from "./platform";
import { loadUpdateRecord, saveUpdateRecord, type UpdateRecord } from "./state";
import { INSTALLED_VERSION, isNewer } from "./version";

export interface StartupOptions {
	context: InstallContext;
	installedVersion?: string;
	recordPath?: string;
	isAlive?: IsAlive;
	loadRecord?: (path?: string) => Promise<UpdateRecord>;
}

export interface StartupResult {
	/** Set when an update was just installed: restart into this version. */
	restartVersion: string | null;
	/** Why nothing (more) was done, for the message log. */
	reason: string | null;
}

/**
 * Runs before the interface exists. Clears what an interrupted update left
 * beside the app and, when the user had agreed to an update that was verified
 * but never installed (terminal closed, process killed), installs it now.
 *
 * It must never keep the app from starting, so it never throws: any failure
 * is returned as a reason and the installed version simply runs.
 */
export async function runStartupTasks(
	options: StartupOptions,
): Promise<StartupResult> {
	const { context } = options;
	if (context.kind === null || context.availability !== "ok") {
		return { restartVersion: null, reason: null };
	}
	const target = context.targetPath;
	const installed = options.installedVersion ?? INSTALLED_VERSION;

	try {
		const load = options.loadRecord ?? loadUpdateRecord;
		const record = await load(options.recordPath);
		const before = JSON.stringify(record);

		if (record.available && !isNewer(record.available.version, installed)) {
			record.available = null;
		}

		// Another live copy is downloading or installing: its files are in use.
		if (!(await acquireLock(target, { isAlive: options.isAlive }))) {
			if (JSON.stringify(record) !== before) {
				await saveUpdateRecord(record, options.recordPath);
			}
			return {
				restartVersion: null,
				reason: "another copy of the app is updating",
			};
		}

		let restartVersion: string | null = null;
		let reason: string | null = null;
		try {
			await unlink(partPath(target)).catch(() => {});

			const pending = record.pending;
			const ready =
				pending !== null &&
				pending.sha256 !== null &&
				pending.targetPath === target &&
				isNewer(pending.version, installed) &&
				(await Bun.file(stagedPath(target)).exists());

			if (pending && ready && pending.sha256) {
				try {
					await installUpdate({
						target,
						expectedSha256: pending.sha256,
						identity: context.identity,
						kind: context.kind,
					});
					restartVersion = pending.version;
					record.installedFrom = installed;
					record.available = null;
				} catch (err) {
					reason = `Update to ${pending.version} was not installed: ${errorMessage(err)}`;
					// A lock on the previous backup clears by itself; keep the
					// agreed update for the next start. Anything else is final.
					if (err instanceof UpdateError && err.kind === "locked") {
						await saveUpdateRecord(record, options.recordPath);
						return { restartVersion: null, reason };
					}
				}
			}
			record.pending = null;
			if (restartVersion === null) {
				await unlink(stagedPath(target)).catch(() => {});
			}
		} finally {
			await releaseLock(target);
		}

		if (JSON.stringify(record) !== before) {
			await saveUpdateRecord(record, options.recordPath);
		}
		return { restartVersion, reason };
	} catch (err) {
		return { restartVersion: null, reason: errorMessage(err) };
	}
}
