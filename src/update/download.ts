import { open as fsOpen, rename, unlink } from "node:fs/promises";
import { errorMessage, UpdateError } from "./errors";
import { readCapped, safeFetch, withTimeout } from "./http";
import {
	CHECKSUMS_ASSET,
	DEFAULT_SOURCE,
	REQUEST_HEADERS,
	type ReleaseSource,
} from "./release";

const CHECKSUM_TIMEOUT_MS = 10_000;
const MAX_CHECKSUM_BYTES = 64 * 1024;
const STALL_TIMEOUT_MS = 30_000;

// Download addresses are built here from the tag and the asset name the app
// already knows. Nothing from the release API answer is used as an address.
function assetUrl(source: ReleaseSource, tag: string, asset: string): string {
	return `${source.download}/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`;
}

export interface ChecksumOptions {
	tag: string;
	assetName: string;
	fetch?: typeof fetch;
	source?: ReleaseSource;
	timeoutMs?: number;
}

/**
 * The published SHA-256 of `assetName`, or null when the release lists none
 * for it. Lines follow `sha256sum`: 64 lowercase hex, two spaces, the name.
 */
export async function fetchChecksum(
	options: ChecksumOptions,
): Promise<string | null> {
	const source = options.source ?? DEFAULT_SOURCE;
	const text = await withTimeout(
		options.timeoutMs ?? CHECKSUM_TIMEOUT_MS,
		async (signal) => {
			const response = await safeFetch(
				assetUrl(source, options.tag, CHECKSUMS_ASSET),
				{
					fetch: options.fetch,
					headers: REQUEST_HEADERS,
					signal,
					allowHttp: source.allowHttp,
				},
			);
			if (response.status !== 200) {
				await response.body?.cancel().catch(() => {});
				throw new Error(`HTTP ${response.status}`);
			}
			return readCapped(response, MAX_CHECKSUM_BYTES);
		},
	);
	for (const line of text.split("\n")) {
		const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line.trimEnd());
		if (match && match[2] === options.assetName) return match[1] ?? null;
	}
	return null;
}

interface WritableFile {
	write(chunk: Uint8Array): Promise<unknown>;
	close(): Promise<void>;
}

export interface DownloadDeps {
	open: (path: string, flags: string, mode: number) => Promise<WritableFile>;
}

export interface DownloadOptions {
	tag: string;
	assetName: string;
	/** Size announced by the release: the hard upper bound for the download. */
	sizeBytes: number;
	expectedSha256: string;
	/** The app file; staging files are created beside it. */
	targetPath: string;
	signal?: AbortSignal;
	onProgress?: (received: number, total: number) => void;
	fetch?: typeof fetch;
	source?: ReleaseSource;
	stallTimeoutMs?: number;
	deps?: Partial<DownloadDeps>;
}

/**
 * Streams the artifact to `<target>.part` (private, mode 0600) while hashing
 * it, and renames it to `<target>.new` only when the hash equals the published
 * one. On every other outcome the partial file is removed and an UpdateError
 * says why. Resolves with the verified hash.
 */
export async function downloadArtifact(
	options: DownloadOptions,
): Promise<string> {
	const source = options.source ?? DEFAULT_SOURCE;
	const open = options.deps?.open ?? fsOpen;
	const stallMs = options.stallTimeoutMs ?? STALL_TIMEOUT_MS;
	const part = `${options.targetPath}.part`;
	const staged = `${options.targetPath}.new`;
	const external = options.signal;

	if (external?.aborted) throw new UpdateError("cancelled", "cancelled");

	const controller = new AbortController();
	let stalled = false;
	const onExternalAbort = () => controller.abort();
	external?.addEventListener("abort", onExternalAbort, { once: true });
	const aborted = new Promise<never>((_resolve, reject) => {
		controller.signal.addEventListener("abort", () =>
			reject(new Error("aborted")),
		);
	});
	// Nothing awaits it when the download finishes first.
	aborted.catch(() => {});

	const interrupted = (err: unknown): UpdateError => {
		if (external?.aborted) return new UpdateError("cancelled", "cancelled");
		if (stalled) return new UpdateError("network", "the download stalled");
		return new UpdateError("network", errorMessage(err));
	};

	let file: WritableFile | null = null;
	let created = false;
	try {
		let response: Response;
		try {
			response = await safeFetch(
				assetUrl(source, options.tag, options.assetName),
				{
					fetch: options.fetch,
					headers: REQUEST_HEADERS,
					signal: controller.signal,
					allowHttp: source.allowHttp,
				},
			);
		} catch (err) {
			throw interrupted(err);
		}
		if (response.status !== 200 || !response.body) {
			await response.body?.cancel().catch(() => {});
			throw new UpdateError("network", `HTTP ${response.status}`);
		}

		try {
			// Remove whatever an earlier attempt left, then create exclusively:
			// "wx" never follows or truncates a file put there in between.
			await unlink(part).catch(() => {});
			file = await open(part, "wx", 0o600);
			created = true;
		} catch (err) {
			await response.body.cancel().catch(() => {});
			throw new UpdateError("storage", errorMessage(err));
		}

		const hasher = new Bun.CryptoHasher("sha256");
		const reader = response.body.getReader();
		let received = 0;
		try {
			for (;;) {
				const timer = setTimeout(() => {
					stalled = true;
					controller.abort();
				}, stallMs);
				let result: Awaited<ReturnType<typeof reader.read>>;
				try {
					result = await Promise.race([reader.read(), aborted]);
				} catch (err) {
					throw interrupted(err);
				} finally {
					clearTimeout(timer);
				}
				if (result.done) break;
				received += result.value.byteLength;
				if (received > options.sizeBytes) {
					throw new UpdateError(
						"too-large",
						"the download is larger than the release announced",
					);
				}
				hasher.update(result.value);
				try {
					await file.write(result.value);
				} catch (err) {
					throw new UpdateError("storage", errorMessage(err));
				}
				options.onProgress?.(received, options.sizeBytes);
				if (controller.signal.aborted) throw interrupted(null);
			}
		} finally {
			await reader.cancel().catch(() => {});
		}

		await file.close();
		file = null;

		const actual = hasher.digest("hex");
		if (actual !== options.expectedSha256) {
			throw new UpdateError(
				"checksum-mismatch",
				"the download does not match the published checksum",
			);
		}
		try {
			await unlink(staged).catch(() => {});
			await rename(part, staged);
			created = false;
		} catch (err) {
			throw new UpdateError("storage", errorMessage(err));
		}
		return actual;
	} finally {
		external?.removeEventListener("abort", onExternalAbort);
		await file?.close().catch(() => {});
		if (created) await unlink(part).catch(() => {});
	}
}
