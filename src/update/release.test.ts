import { expect, test } from "bun:test";
import { checkForUpdate, type ReleaseSource, sanitizeNotes } from "./release";
import { RELEASES_PAGE_URL } from "./state";

const SOURCE: ReleaseSource = {
	api: "https://api.github.com",
	download: "https://github.com/radekBednarik/pairwise-tui/releases/download",
	allowHttp: false,
};

const LATEST_URL =
	"https://api.github.com/repos/radekBednarik/pairwise-tui/releases/latest";

function release(over: Record<string, unknown> = {}) {
	return {
		tag_name: "v1.8.0",
		draft: false,
		prerelease: false,
		body: "## What's new\n- thing",
		html_url:
			"https://github.com/radekBednarik/pairwise-tui/releases/tag/v1.8.0",
		assets: [
			{
				name: "pairwise-tui",
				size: 1234,
				browser_download_url: "https://evil.example/pairwise-tui",
			},
			{ name: "pairwise-tui.exe", size: 2345 },
			{ name: "SHA256SUMS.txt", size: 200 },
		],
		...over,
	};
}

interface Call {
	url: string;
	init: RequestInit | undefined;
}

function stubFetch(respond: (url: string) => Response | Promise<Response>) {
	const calls: Call[] = [];
	const fn = (async (input: unknown, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		return respond(url);
	}) as unknown as typeof fetch;
	return { fn, calls };
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function check(fetchFn: typeof fetch, over: Record<string, unknown> = {}) {
	return checkForUpdate({
		fetch: fetchFn,
		installedVersion: "1.7.0",
		assetName: "pairwise-tui",
		source: SOURCE,
		...over,
	});
}

test("asks the latest-release endpoint and sends nothing identifying", async () => {
	const { fn, calls } = stubFetch(() => json(release()));
	await check(fn);
	expect(calls).toHaveLength(1);
	expect(calls[0]?.url).toBe(LATEST_URL);
	const headers = new Headers(calls[0]?.init?.headers);
	expect(headers.get("accept")).toBe("application/vnd.github+json");
	expect(headers.get("user-agent")).toBe("pairwise-tui");
	const sent: string[] = [];
	headers.forEach((_value, name) => {
		sent.push(name);
	});
	expect(sent.sort()).toEqual(["accept", "user-agent"]);
	expect(calls[0]?.init?.body).toBeUndefined();
	expect(calls[0]?.init?.method ?? "GET").toBe("GET");
});

test("a higher release with the asset and checksums is an update", async () => {
	const { fn } = stubFetch(() => json(release()));
	expect(await check(fn)).toEqual({
		version: "1.8.0",
		tag: "v1.8.0",
		notes: "## What's new\n- thing",
		pageUrl:
			"https://github.com/radekBednarik/pairwise-tui/releases/tag/v1.8.0",
		assetName: "pairwise-tui",
		sizeBytes: 1234,
	});
});

test("the asset size is taken for the requested artifact", async () => {
	const { fn } = stubFetch(() => json(release()));
	const found = await check(fn, { assetName: "pairwise-tui.exe" });
	expect(found?.sizeBytes).toBe(2345);
});

test("no update when the release does not qualify", async () => {
	const cases = [
		release({ tag_name: "1.8.0" }),
		release({ tag_name: "v1.8.0-beta" }),
		release({ tag_name: "v1.8" }),
		release({ tag_name: "v1.7.0" }),
		release({ tag_name: "v1.6.9" }),
		release({ tag_name: 180 }),
		release({ draft: true }),
		release({ prerelease: true }),
		release({ draft: "false" }),
		release({ assets: [{ name: "SHA256SUMS.txt", size: 200 }] }),
		release({ assets: [{ name: "pairwise-tui", size: 1234 }] }),
		release({
			assets: [
				{ name: "pairwise-tui", size: 0 },
				{ name: "SHA256SUMS.txt", size: 200 },
			],
		}),
		release({ assets: "none" }),
	];
	for (const body of cases) {
		const { fn } = stubFetch(() => json(body));
		expect(await check(fn)).toBeNull();
	}
});

test("the download URL from the response is never used", async () => {
	const { fn } = stubFetch(() => json(release()));
	const found = await check(fn);
	expect(JSON.stringify(found)).not.toContain("evil.example");
});

test("a page URL outside the project's releases is replaced", async () => {
	const { fn } = stubFetch(() =>
		json(release({ html_url: "https://evil.example/phish" })),
	);
	expect((await check(fn))?.pageUrl).toBe(RELEASES_PAGE_URL);
});

test("release notes are sanitized", async () => {
	const { fn } = stubFetch(() =>
		json(release({ body: "ok\x1b[31mred\x07\r\nnext" })),
	);
	expect((await check(fn))?.notes).toBe("ok[31mred\nnext");
});

test("a non-200 answer rejects with a short reason", async () => {
	const { fn } = stubFetch(() => json({ message: "rate limit" }, 403));
	await expect(check(fn)).rejects.toThrow("HTTP 403");
});

test("invalid JSON rejects", async () => {
	const { fn } = stubFetch(() => new Response("<html>", { status: 200 }));
	await expect(check(fn)).rejects.toThrow("invalid response");
});

test("a response over 1 MB rejects", async () => {
	const { fn } = stubFetch(
		() => new Response("x".repeat(1024 * 1024 + 1), { status: 200 }),
	);
	await expect(check(fn)).rejects.toThrow("response too large");
});

test("a request that does not answer in time rejects", async () => {
	const fn = ((_input: unknown, init?: RequestInit) =>
		new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener("abort", () =>
				reject(init.signal?.reason ?? new Error("aborted")),
			);
		})) as unknown as typeof fetch;
	await expect(check(fn, { timeoutMs: 20 })).rejects.toThrow("timed out");
});

test("a network failure rejects with its message", async () => {
	const fn = (async () => {
		throw new Error("getaddrinfo ENOTFOUND api.github.com");
	}) as unknown as typeof fetch;
	await expect(check(fn)).rejects.toThrow("ENOTFOUND");
});

test("a redirect to a non-https address is refused", async () => {
	const { fn, calls } = stubFetch(
		() =>
			new Response(null, {
				status: 302,
				headers: { location: "http://insecure.example/latest" },
			}),
	);
	await expect(check(fn)).rejects.toThrow("insecure");
	expect(calls).toHaveLength(1);
});

test("sanitizeNotes strips every control character except newline and tab", () => {
	expect(sanitizeNotes("a\x1b[31mb")).toBe("a[31mb");
	expect(sanitizeNotes("bell\x07 null\x00 del\x7f")).toBe("bell null del");
	expect(sanitizeNotes("c1\x9b31m\x85x")).toBe("c131mx");
	expect(sanitizeNotes("line1\r\nline2\ttabbed")).toBe("line1\nline2\ttabbed");
	expect(sanitizeNotes("osc\x1b]0;title\x07end")).toBe("osc]0;titleend");
});

test("sanitizeNotes truncates and tolerates non-strings", () => {
	expect(sanitizeNotes("x".repeat(30_000)).length).toBe(20_000);
	expect(sanitizeNotes(null)).toBe("");
	expect(sanitizeNotes(42)).toBe("");
	expect(sanitizeNotes(undefined)).toBe("");
});
