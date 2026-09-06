import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { PictModel, PictOptions } from "../types";
import { getPictBinaryPath, runPict } from "./runner";

let dir: string;
const savedTmp = process.env.TMPDIR;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-runner-test-"));
	process.env.TMPDIR = dir;
});

afterEach(async () => {
	if (savedTmp === undefined) delete process.env.TMPDIR;
	else process.env.TMPDIR = savedTmp;
	await rm(dir, { recursive: true, force: true });
});

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

test("the extracted binary lives in a directory no other user can enter", async () => {
	const binaryPath = await getPictBinaryPath();
	const dirMode = (await stat(dirname(binaryPath))).mode & 0o777;
	expect(dirMode.toString(8)).toBe("700");
});

test("an existing extraction directory that is too permissive is tightened", async () => {
	const first = await getPictBinaryPath();
	const extractionDir = dirname(first);
	await Bun.$`chmod 777 ${extractionDir}`.quiet();

	// A fresh temp root forces re-extraction, so re-point TMPDIR at the same dir.
	process.env.TMPDIR = dir;
	await getPictBinaryPath();

	const mode = (await stat(extractionDir)).mode & 0o777;
	expect(mode.toString(8)).toBe("700");
});

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

test("no model file is left behind when the binary cannot be launched", async () => {
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
});
