import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	test,
} from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadArtifact, fetchChecksum } from "./download";
import { UpdateError } from "./errors";
import type { ReleaseSource } from "./release";

const ARTIFACT = Buffer.alloc(300_000, 7);
const ARTIFACT_SHA = createHash("sha256").update(ARTIFACT).digest("hex");
const OTHER_SHA = "b".repeat(64);

let server: ReturnType<typeof Bun.serve>;
let source: ReleaseSource;
let dir: string;
let target: string;
let requests: string[];
let sums: string;
let artifactBody: () => Response;

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const path = new URL(req.url).pathname;
			requests.push(path);
			if (path === "/download/v1.8.0/SHA256SUMS.txt") return new Response(sums);
			if (path === "/download/v1.8.0/pairwise-tui") return artifactBody();
			if (path === "/download/v1.8.0/redirect-http") {
				return new Response(null, {
					status: 302,
					headers: { location: "http://insecure.example/x" },
				});
			}
			return new Response("nope", { status: 404 });
		},
	});
});

afterAll(() => {
	server.stop(true);
});

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-update-download-"));
	target = join(dir, "pairwise-tui");
	await Bun.write(target, "old");
	requests = [];
	sums = `${ARTIFACT_SHA}  pairwise-tui\n${OTHER_SHA}  pairwise-tui.exe\n`;
	artifactBody = () => new Response(ARTIFACT);
	source = {
		api: `http://localhost:${server.port}/api`,
		download: `http://localhost:${server.port}/download`,
		allowHttp: true,
	};
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

function download(over: Record<string, unknown> = {}) {
	return downloadArtifact({
		tag: "v1.8.0",
		assetName: "pairwise-tui",
		sizeBytes: ARTIFACT.length,
		expectedSha256: ARTIFACT_SHA,
		targetPath: target,
		source,
		...over,
	});
}

async function kind(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (e) {
		return e instanceof UpdateError ? e.kind : `not UpdateError: ${e}`;
	}
	return "resolved";
}

test("fetchChecksum reads the line for the asset", async () => {
	expect(
		await fetchChecksum({ tag: "v1.8.0", assetName: "pairwise-tui", source }),
	).toBe(ARTIFACT_SHA);
	expect(
		await fetchChecksum({
			tag: "v1.8.0",
			assetName: "pairwise-tui.exe",
			source,
		}),
	).toBe(OTHER_SHA);
	expect(requests).toEqual([
		"/download/v1.8.0/SHA256SUMS.txt",
		"/download/v1.8.0/SHA256SUMS.txt",
	]);
});

test("fetchChecksum is null when the line is absent or malformed", async () => {
	const cases = [
		"",
		`${OTHER_SHA}  pairwise-tui.exe\n`,
		`${ARTIFACT_SHA} pairwise-tui\n`,
		`${ARTIFACT_SHA.toUpperCase()}  pairwise-tui\n`,
		`${ARTIFACT_SHA.slice(1)}  pairwise-tui\n`,
		`${ARTIFACT_SHA}  pairwise-tui-extra\n`,
	];
	for (const body of cases) {
		sums = body;
		expect(
			await fetchChecksum({ tag: "v1.8.0", assetName: "pairwise-tui", source }),
		).toBeNull();
	}
});

test("fetchChecksum rejects a body over 64 KB", async () => {
	sums = `${ARTIFACT_SHA}  pairwise-tui\n${"x".repeat(70_000)}`;
	await expect(
		fetchChecksum({ tag: "v1.8.0", assetName: "pairwise-tui", source }),
	).rejects.toThrow("response too large");
});

test("fetchChecksum rejects when the file is not there", async () => {
	await expect(
		fetchChecksum({ tag: "v9.9.9", assetName: "pairwise-tui", source }),
	).rejects.toThrow("HTTP 404");
});

test("a verified download becomes <target>.new and reports progress", async () => {
	const seen: Array<[number, number]> = [];
	const sha = await download({
		onProgress: (received: number, total: number) =>
			seen.push([received, total]),
	});
	expect(sha).toBe(ARTIFACT_SHA);
	expect((await readdir(dir)).sort()).toEqual([
		"pairwise-tui",
		"pairwise-tui.new",
	]);
	expect(
		Buffer.from(await Bun.file(`${target}.new`).arrayBuffer()).equals(ARTIFACT),
	).toBe(true);
	expect(await Bun.file(target).text()).toBe("old");
	expect(seen.length).toBeGreaterThan(0);
	expect(seen.at(-1)).toEqual([ARTIFACT.length, ARTIFACT.length]);
	for (const [, total] of seen) expect(total).toBe(ARTIFACT.length);
});

test.skipIf(process.platform === "win32")(
	"the partial file is private while downloading",
	async () => {
		let mode = 0;
		let resolveGate: () => void = () => {};
		const gate = new Promise<void>((r) => {
			resolveGate = r;
		});
		artifactBody = () =>
			new Response(
				new ReadableStream({
					async start(controller) {
						controller.enqueue(ARTIFACT.subarray(0, 1000));
						await gate;
						controller.enqueue(ARTIFACT.subarray(1000));
						controller.close();
					},
				}),
			);
		const p = download({
			onProgress: async () => {
				if (mode === 0) {
					mode = (await stat(`${target}.part`)).mode & 0o777;
					resolveGate();
				}
			},
		});
		await p;
		expect(mode).toBe(0o600);
	},
);

test("a checksum mismatch leaves nothing behind", async () => {
	expect(await kind(download({ expectedSha256: OTHER_SHA }))).toBe(
		"checksum-mismatch",
	);
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("more bytes than announced aborts the download", async () => {
	expect(await kind(download({ sizeBytes: 1000 }))).toBe("too-large");
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("a short download fails verification", async () => {
	artifactBody = () => new Response(ARTIFACT.subarray(0, 5000));
	expect(await kind(download())).toBe("checksum-mismatch");
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("cancelling removes the partial file", async () => {
	const controller = new AbortController();
	artifactBody = () =>
		new Response(
			new ReadableStream({
				start(c) {
					c.enqueue(ARTIFACT.subarray(0, 1000));
				},
			}),
		);
	const p = download({
		signal: controller.signal,
		onProgress: () => controller.abort(),
	});
	expect(await kind(p)).toBe("cancelled");
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("an already cancelled signal never starts", async () => {
	const controller = new AbortController();
	controller.abort();
	expect(await kind(download({ signal: controller.signal }))).toBe("cancelled");
	expect(requests).toEqual([]);
});

test("a missing artifact is a network failure", async () => {
	expect(await kind(download({ tag: "v9.9.9" }))).toBe("network");
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("a plain http address is refused without the override", async () => {
	const strict = { ...source, allowHttp: false };
	expect(await kind(download({ source: strict }))).toBe("network");
	expect(requests).toEqual([]);
});

test("a stalled download gives up", async () => {
	artifactBody = () =>
		new Response(
			new ReadableStream({
				start(c) {
					c.enqueue(ARTIFACT.subarray(0, 1000));
				},
			}),
		);
	expect(await kind(download({ stallTimeoutMs: 50 }))).toBe("network");
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("a storage failure removes the partial file", async () => {
	const failingOpen = (async (path: string, flags: string, mode: number) => {
		const { open } = await import("node:fs/promises");
		const handle = await open(path, flags, mode);
		return {
			write: async () => {
				throw Object.assign(new Error("ENOSPC: no space left on device"), {
					code: "ENOSPC",
				});
			},
			close: () => handle.close(),
		};
	}) as never;
	expect(await kind(download({ deps: { open: failingOpen } }))).toBe("storage");
	expect(await readdir(dir)).toEqual(["pairwise-tui"]);
});

test("a stale partial file from an earlier attempt is replaced", async () => {
	await Bun.write(`${target}.part`, "junk from before");
	expect(await download()).toBe(ARTIFACT_SHA);
	expect((await readdir(dir)).sort()).toEqual([
		"pairwise-tui",
		"pairwise-tui.new",
	]);
});
