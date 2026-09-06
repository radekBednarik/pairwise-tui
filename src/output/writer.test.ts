import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ExportContext,
	OutputFormat,
	PictModel,
	PictOptions,
} from "../types";
import { saveTestCases } from "./writer";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-writer-test-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const model: PictModel = { parameters: [], submodels: [], constraints: "" };
const options: PictOptions = {
	order: 2,
	randomize: false,
	caseSensitive: false,
};

function context(
	format: OutputFormat,
	headers: string[],
	rows: Record<string, string>[],
): ExportContext {
	return {
		headers,
		rows,
		config: { filePath: join(dir, `out${format}`), format },
		model,
		options,
	};
}

test("csv export leaves ordinary values untouched", async () => {
	const ctx = context("csv", ["A", "B"], [{ A: "one", B: "two" }]);
	await saveTestCases(ctx);
	expect(await Bun.file(ctx.config.filePath).text()).toBe("A,B\none,two\n");
});

test("csv export keeps quoting values that contain commas or quotes", async () => {
	const ctx = context("csv", ["A"], [{ A: 'a,b"c' }]);
	await saveTestCases(ctx);
	expect(await Bun.file(ctx.config.filePath).text()).toBe('A\n"a,b""c"\n');
});

test("csv export neutralises values that a spreadsheet would read as a formula", async () => {
	const ctx = context(
		"csv",
		["A"],
		[{ A: "=1+1" }, { A: "+1" }, { A: "-1" }, { A: "@SUM(A1)" }],
	);
	await saveTestCases(ctx);
	expect(await Bun.file(ctx.config.filePath).text()).toBe(
		"A\n'=1+1\n'+1\n'-1\n'@SUM(A1)\n",
	);
});

test("csv export neutralises a formula header", async () => {
	const ctx = context("csv", ["=cmd"], [{ "=cmd": "x" }]);
	await saveTestCases(ctx);
	expect(await Bun.file(ctx.config.filePath).text()).toBe("'=cmd\nx\n");
});

test("csv export quotes a neutralised value that also needs quoting", async () => {
	const ctx = context("csv", ["A"], [{ A: "=1,2" }]);
	await saveTestCases(ctx);
	expect(await Bun.file(ctx.config.filePath).text()).toBe('A\n"\'=1,2"\n');
});

test("saving with an unknown format reports the format instead of crashing", async () => {
	const ctx = context("bogus" as OutputFormat, ["A"], [{ A: "one" }]);
	expect(saveTestCases(ctx)).rejects.toThrow(
		"Unsupported output format: bogus",
	);
});

test("csv export quotes a value containing a carriage return", async () => {
	// A bare CR is a record terminator for Excel/LibreOffice, so an unquoted one
	// would start a new record with whatever follows it in first-cell position.
	const ctx = context("csv", ["A"], [{ A: "safe\r=1+1" }]);
	await saveTestCases(ctx);
	expect(await Bun.file(ctx.config.filePath).text()).toBe('A\n"safe\r=1+1"\n');
});

test("a format name inherited from Object.prototype is rejected", async () => {
	const ctx = context("toString" as OutputFormat, ["A"], [{ A: "one" }]);
	expect(saveTestCases(ctx)).rejects.toThrow(
		"Unsupported output format: toString",
	);
});
