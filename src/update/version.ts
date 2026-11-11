import pkg from "../../package.json";

/** The version of the running app. package.json is the single source. */
export const INSTALLED_VERSION: string = pkg.version;

/**
 * True only in a compiled artifact. Run from source, `process.execPath` is the
 * Bun runtime, so the updater must stay inert.
 */
export const IS_RELEASE_BUILD: boolean =
	typeof __RELEASE_BUILD__ !== "undefined";

export interface Version {
	major: number;
	minor: number;
	patch: number;
}

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(value: unknown): Version | null {
	if (typeof value !== "string") return null;
	// `$` alone would also match before a trailing newline.
	if (value.includes("\n")) return null;
	const match = VERSION_PATTERN.exec(value);
	if (!match) return null;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

/** Strictly newer. Equal, lower or unparsable is never an update. */
export function isNewer(candidate: string, installed: string): boolean {
	const a = parseVersion(candidate);
	const b = parseVersion(installed);
	if (!a || !b) return false;
	if (a.major !== b.major) return a.major > b.major;
	if (a.minor !== b.minor) return a.minor > b.minor;
	return a.patch > b.patch;
}

/** `v1.2.3` or `1.2.3` to `1.2.3`; null when it is not a version. */
export function normalizeVersion(value: unknown): string | null {
	const v = parseVersion(value);
	return v ? `${v.major}.${v.minor}.${v.patch}` : null;
}
