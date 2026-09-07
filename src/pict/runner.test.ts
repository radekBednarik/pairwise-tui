import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { PictModel, PictOptions } from "../types";
import { getPictBinaryPath, launchWithLockRetry, runPict } from "./runner";

// os.tmpdir() reads TMPDIR on POSIX and TEMP/TMP on Windows, so all three have
// to move for the extraction directory to land inside the test's sandbox.
const TMP_VARS = ["TMPDIR", "TEMP", "TMP"] as const;
const posixOnly = process.platform === "win32" ? test.skip : test;

let dir: string;
let saved: Record<string, string | undefined>;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-runner-test-"));
	saved = {};
	for (const key of TMP_VARS) {
		saved[key] = process.env[key];
		process.env[key] = dir;
	}
});

afterEach(async () => {
	for (const key of TMP_VARS) {
		const value = saved[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	await rm(dir, { recursive: true, force: true });
});

/** Points the temp root somewhere else and back, dropping the in-process
 * extraction cache the way a freshly started process would. */
async function simulateColdStart(): Promise<void> {
	const other = await mkdtemp(join(tmpdir(), "pairwise-runner-other-"));
	try {
		for (const key of TMP_VARS) process.env[key] = other;
		await getPictBinaryPath();
	} finally {
		for (const key of TMP_VARS) process.env[key] = dir;
		await rm(other, { recursive: true, force: true });
	}
}

const options: PictOptions = {
	order: 2,
	randomize: false,
	caseSensitive: false,
};

const model: PictModel = {
	parameters: [
		{ name: "OS", values: ["Linux", "Windows"] },
		{ name: "Browser", values: ["Chrome", "Firefox"] },
	],
	submodels: [],
	constraints: "",
};

test("generates test cases covering every parameter", async () => {
	const cases = await runPict(model, options);
	expect(cases.length).toBeGreaterThan(0);
	for (const testCase of cases) {
		expect(Object.keys(testCase).sort()).toEqual(["Browser", "OS"]);
	}
});

posixOnly(
	"the extracted binary lives in a directory no other user can enter",
	async () => {
		const binaryPath = await getPictBinaryPath();
		const dirMode = (await stat(dirname(binaryPath))).mode & 0o777;
		expect(dirMode.toString(8)).toBe("700");
	},
);

posixOnly(
	"an existing extraction directory that is too permissive is tightened",
	async () => {
		const first = await getPictBinaryPath();
		const extractionDir = dirname(first);
		await Bun.$`chmod 777 ${extractionDir}`.quiet();

		await simulateColdStart();
		await getPictBinaryPath();

		const mode = (await stat(extractionDir)).mode & 0o777;
		expect(mode.toString(8)).toBe("700");
	},
);

test("no model file is left behind after a successful run", async () => {
	const binaryPath = await getPictBinaryPath();
	await runPict(model, options);
	const leftovers = (await readdir(dirname(binaryPath))).filter((f) =>
		f.endsWith(".txt"),
	);
	expect(leftovers).toEqual([]);
});

test("no model file is left behind when pict rejects the model", async () => {
	const binaryPath = await getPictBinaryPath();
	const duplicateNames: PictModel = {
		parameters: [
			{ name: "OS", values: ["Linux"] },
			{ name: "OS", values: ["Windows"] },
		],
		submodels: [],
		constraints: "",
	};
	await expect(runPict(duplicateNames, options)).rejects.toThrow(
		/parameter names must be unique/i,
	);
	const leftovers = (await readdir(dirname(binaryPath))).filter((f) =>
		f.endsWith(".txt"),
	);
	expect(leftovers).toEqual([]);
});

posixOnly(
	"no model file is left behind when the binary cannot be launched",
	async () => {
		const binaryPath = await getPictBinaryPath();
		await Bun.$`chmod 000 ${binaryPath}`.quiet();
		try {
			await expect(runPict(model, options)).rejects.toThrow(
				/Failed to launch pict binary/,
			);
			const leftovers = (await readdir(dirname(binaryPath))).filter((f) =>
				f.endsWith(".txt"),
			);
			expect(leftovers).toEqual([]);
		} finally {
			await Bun.$`chmod 755 ${binaryPath}`.quiet();
		}
	},
);

test("a binary left by an earlier run is reused instead of rewritten", async () => {
	// Rewriting the executable makes Windows refuse the next launch with EBUSY,
	// so a cold start that finds a good extraction must leave the file alone.
	const binaryPath = await getPictBinaryPath();
	const before = await stat(binaryPath);

	await simulateColdStart();
	await Bun.sleep(20);

	expect(await getPictBinaryPath()).toBe(binaryPath);
	expect((await stat(binaryPath)).mtimeMs).toBe(before.mtimeMs);
});

test("a truncated extraction is replaced rather than launched", async () => {
	const binaryPath = await getPictBinaryPath();
	await Bun.write(binaryPath, "not a binary");

	await simulateColdStart();

	expect(await getPictBinaryPath()).toBe(binaryPath);
	expect((await runPict(model, options)).length).toBeGreaterThan(0);
});

test("extraction leaves no staging files behind", async () => {
	const binaryPath = await getPictBinaryPath();
	const leftovers = (await readdir(dirname(binaryPath))).filter((f) =>
		f.endsWith(".tmp"),
	);
	expect(leftovers).toEqual([]);
});

test("a launch blocked by the Windows file lock is retried until it succeeds", async () => {
	let attempts = 0;
	const result = await launchWithLockRetry(() => {
		attempts++;
		if (attempts < 3) {
			throw Object.assign(
				new Error("EBUSY: resource busy or locked, uv_spawn"),
				{
					code: "EBUSY",
				},
			);
		}
		return "launched";
	});
	expect(result).toBe("launched");
	expect(attempts).toBe(3);
});

test("a launch that stays locked eventually gives up", async () => {
	let attempts = 0;
	await expect(
		launchWithLockRetry(() => {
			attempts++;
			throw new Error("EBUSY: resource busy or locked, uv_spawn");
		}),
	).rejects.toThrow(/EBUSY/);
	expect(attempts).toBe(6);
});

test("a launch failure that is not a lock is reported at once", async () => {
	let attempts = 0;
	await expect(
		launchWithLockRetry(() => {
			attempts++;
			throw Object.assign(new Error("EACCES: permission denied, uv_spawn"), {
				code: "EACCES",
			});
		}),
	).rejects.toThrow(/EACCES/);
	expect(attempts).toBe(1);
});
