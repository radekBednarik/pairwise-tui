import { readCapped, safeFetch, withTimeout } from "./http";
import { type AvailableUpdate, MAX_ARTIFACT_BYTES, safePageUrl } from "./state";
import { sanitizeNotes } from "./text";
import { isNewer, normalizeVersion } from "./version";

const REPO = "radekBednarik/pairwise-tui";
export const CHECKSUMS_ASSET = "SHA256SUMS.txt";
const USER_AGENT = "pairwise-tui";
const CHECK_TIMEOUT_MS = 10_000;
const MAX_CHECK_BYTES = 1024 * 1024;

export interface ReleaseSource {
	/** Base of the release API. */
	api: string;
	/** Base that `<tag>/<asset>` is appended to. */
	download: string;
	allowHttp: boolean;
}

const GITHUB_SOURCE: ReleaseSource = {
	api: "https://api.github.com",
	download: `https://github.com/${REPO}/releases/download`,
	allowHttp: false,
};

/**
 * Where updates come from. Fixed at build time: a released artifact contains
 * only the GitHub addresses, and nothing at runtime (no setting, no
 * environment variable) can point it elsewhere. The override exists for the
 * manual test rig and is baked in by scripts/build-common.ts.
 */
export const DEFAULT_SOURCE: ReleaseSource =
	typeof __UPDATE_SOURCE_OVERRIDE__ === "string"
		? {
				api: `${__UPDATE_SOURCE_OVERRIDE__}/api`,
				download: `${__UPDATE_SOURCE_OVERRIDE__}/download`,
				allowHttp: true,
			}
		: GITHUB_SOURCE;

export const REQUEST_HEADERS = { "User-Agent": USER_AGENT } as const;

export { sanitizeNotes };

export interface CheckOptions {
	installedVersion: string;
	assetName: string;
	fetch?: typeof fetch;
	source?: ReleaseSource;
	timeoutMs?: number;
}

type Unknown = Record<string, unknown>;

function assetSize(assets: unknown, name: string): number | null {
	if (!Array.isArray(assets)) return null;
	for (const asset of assets as unknown[]) {
		if (typeof asset !== "object" || asset === null) continue;
		const a = asset as Unknown;
		if (a.name !== name) continue;
		return typeof a.size === "number" &&
			Number.isInteger(a.size) &&
			a.size > 0 &&
			a.size <= MAX_ARTIFACT_BYTES
			? a.size
			: null;
	}
	return null;
}

/**
 * Asks the release source for the latest stable release. Resolves with the
 * update when it is strictly newer and ships both this install's artifact and
 * the checksum file; with null when there is nothing to offer. Rejects, with a
 * short reason, only when the source could not be asked.
 *
 * The request carries no token, cookie, query or machine detail. The
 * `browser_download_url` fields of the answer are deliberately never read:
 * download addresses are built by the app from the tag (see download.ts).
 */
export async function checkForUpdate(
	options: CheckOptions,
): Promise<AvailableUpdate | null> {
	const source = options.source ?? DEFAULT_SOURCE;
	const url = `${source.api}/repos/${REPO}/releases/latest`;

	const text = await withTimeout(
		options.timeoutMs ?? CHECK_TIMEOUT_MS,
		async (signal) => {
			const response = await safeFetch(url, {
				fetch: options.fetch,
				headers: { ...REQUEST_HEADERS, Accept: "application/vnd.github+json" },
				signal,
				allowHttp: source.allowHttp,
			});
			if (response.status !== 200) {
				await response.body?.cancel().catch(() => {});
				throw new Error(`HTTP ${response.status}`);
			}
			return readCapped(response, MAX_CHECK_BYTES);
		},
	);

	let release: Unknown;
	try {
		const parsed: unknown = JSON.parse(text);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			throw new Error("not an object");
		}
		release = parsed as Unknown;
	} catch {
		throw new Error("invalid response");
	}

	const tag = release.tag_name;
	if (typeof tag !== "string" || !/^v\d+\.\d+\.\d+$/.test(tag)) return null;
	const version = normalizeVersion(tag);
	if (!version || !isNewer(version, options.installedVersion)) return null;
	if (release.draft !== false || release.prerelease !== false) return null;

	const sizeBytes = assetSize(release.assets, options.assetName);
	if (sizeBytes === null) return null;
	if (assetSize(release.assets, CHECKSUMS_ASSET) === null) return null;

	return {
		version,
		tag: `v${version}`,
		notes: sanitizeNotes(release.body),
		pageUrl: safePageUrl(release.html_url),
		assetName: options.assetName,
		sizeBytes,
	};
}
