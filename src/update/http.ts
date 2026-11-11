const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface SafeFetchOptions {
	fetch?: typeof fetch;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	/** Only for the build-time test-rig override; never true in a release. */
	allowHttp?: boolean;
}

/**
 * GET that refuses anything but https, on the first address and on every
 * redirect hop. Redirects are followed by hand because the built-in follower
 * gives no chance to inspect where each hop leads.
 */
export async function safeFetch(
	url: string,
	options: SafeFetchOptions = {},
): Promise<Response> {
	const doFetch = options.fetch ?? fetch;
	let current = url;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const protocol = new URL(current).protocol;
		if (protocol !== "https:" && !(options.allowHttp && protocol === "http:")) {
			throw new Error("insecure address refused");
		}
		const response = await doFetch(current, {
			redirect: "manual",
			headers: options.headers,
			signal: options.signal,
		});
		if (!REDIRECT_STATUSES.has(response.status)) return response;
		const location = response.headers.get("location");
		await response.body?.cancel().catch(() => {});
		if (!location) throw new Error("redirect without a location");
		current = new URL(location, current).toString();
	}
	throw new Error("too many redirects");
}

/** Reads a response body, giving up as soon as it exceeds `maxBytes`. */
export async function readCapped(
	response: Response,
	maxBytes: number,
): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) return "";
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => {});
			throw new Error("response too large");
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString("utf8");
}

/** Runs `request` with a deadline; a miss rejects with "timed out". */
export async function withTimeout<T>(
	timeoutMs: number,
	request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await request(controller.signal);
	} catch (err) {
		if (controller.signal.aborted) throw new Error("timed out");
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
