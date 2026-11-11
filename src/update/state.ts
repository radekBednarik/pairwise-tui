import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getAppConfigPath } from "../utils/configPath";
import { normalizeVersion } from "./version";

export const RELEASES_PAGE_URL =
	"https://github.com/radekBednarik/pairwise-tui/releases";
export const MAX_NOTES_LENGTH = 20_000;

export interface AvailableUpdate {
	version: string;
	tag: string;
	notes: string;
	pageUrl: string;
	assetName: string;
	sizeBytes: number;
}

export interface PendingUpdate {
	version: string;
	mode: "now" | "onExit";
	/** Set once the staged file is verified; null while downloading. */
	sha256: string | null;
	targetPath: string;
}

export interface UpdateRecord {
	/** Last successful contact with the release source. */
	lastCheckAt: string | null;
	/** Last automatic attempt, successful or not. */
	lastAttemptAt: string | null;
	available: AvailableUpdate | null;
	skippedVersion: string | null;
	pending: PendingUpdate | null;
	/** Previous version, set by an install until the one-time notice is shown. */
	installedFrom: string | null;
}

export const EMPTY_UPDATE_RECORD: UpdateRecord = {
	lastCheckAt: null,
	lastAttemptAt: null,
	available: null,
	skippedVersion: null,
	pending: null,
	installedFrom: null,
};

type Unknown = Record<string, unknown>;

function asObject(value: unknown): Unknown | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Unknown)
		: null;
}

function asTimestamp(value: unknown): string | null {
	return typeof value === "string" && !Number.isNaN(Date.parse(value))
		? value
		: null;
}

export function safePageUrl(value: unknown): string {
	return typeof value === "string" && value.startsWith(`${RELEASES_PAGE_URL}/`)
		? value
		: RELEASES_PAGE_URL;
}

export function validateAvailable(value: unknown): AvailableUpdate | null {
	const o = asObject(value);
	if (!o) return null;
	const version = normalizeVersion(o.version);
	if (!version || o.version !== version) return null;
	if (o.tag !== `v${version}`) return null;
	if (typeof o.notes !== "string") return null;
	if (typeof o.assetName !== "string" || o.assetName === "") return null;
	if (
		typeof o.sizeBytes !== "number" ||
		!Number.isInteger(o.sizeBytes) ||
		o.sizeBytes <= 0
	) {
		return null;
	}
	return {
		version,
		tag: o.tag,
		notes: o.notes.slice(0, MAX_NOTES_LENGTH),
		pageUrl: safePageUrl(o.pageUrl),
		assetName: o.assetName,
		sizeBytes: o.sizeBytes,
	};
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function validatePending(value: unknown): PendingUpdate | null {
	const o = asObject(value);
	if (!o) return null;
	const version = normalizeVersion(o.version);
	if (!version || o.version !== version) return null;
	if (o.mode !== "now" && o.mode !== "onExit") return null;
	if (
		o.sha256 !== null &&
		!(typeof o.sha256 === "string" && SHA256_PATTERN.test(o.sha256))
	) {
		return null;
	}
	if (typeof o.targetPath !== "string" || o.targetPath === "") return null;
	return {
		version,
		mode: o.mode,
		sha256: o.sha256,
		targetPath: o.targetPath,
	};
}

function validateRecord(value: unknown): UpdateRecord {
	const o = asObject(value);
	if (!o) return { ...EMPTY_UPDATE_RECORD };
	return {
		lastCheckAt: asTimestamp(o.lastCheckAt),
		lastAttemptAt: asTimestamp(o.lastAttemptAt),
		available: validateAvailable(o.available),
		skippedVersion: normalizeVersion(o.skippedVersion),
		pending: validatePending(o.pending),
		installedFrom: normalizeVersion(o.installedFrom),
	};
}

export function getUpdateRecordPath(): string {
	return getAppConfigPath("update.json");
}

// The file sits in a user-writable directory, so it is re-validated on every
// load exactly like config.json: a bad field becomes null, never a crash.
export async function loadUpdateRecord(
	path: string = getUpdateRecordPath(),
): Promise<UpdateRecord> {
	try {
		return validateRecord(JSON.parse(await Bun.file(path).text()));
	} catch {
		return { ...EMPTY_UPDATE_RECORD };
	}
}

export async function saveUpdateRecord(
	record: UpdateRecord,
	path: string = getUpdateRecordPath(),
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	// Through the validator so unknown fields never reach the disk.
	await Bun.write(path, JSON.stringify(validateRecord(record), null, 2));
}
