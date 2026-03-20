import { chmodSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Embedded at compile time — Bun extracts to a temp path at runtime
// @ts-expect-error - Bun file asset embedding
import pictLinuxPath from "../../binaries/pict" with { type: "file" };
// @ts-expect-error - Bun file asset embedding
import pictWinPath from "../../binaries/pict.exe" with { type: "file" };
import type { PictModel, PictOptions, TestCase } from "../types";
import { buildModelFile } from "./model";

let extractedBinaryPath: string | null = null;

export async function getPictBinaryPath(): Promise<string> {
	if (extractedBinaryPath) return extractedBinaryPath;

	const sourcePath = process.platform === "win32" ? pictWinPath : pictLinuxPath;
	const ext = process.platform === "win32" ? ".exe" : "";
	const tmpPath = join(tmpdir(), `pairwise-tui-pict${ext}`);

	// Use Bun.file + Bun.write to reliably read /$bunfs/ virtual paths in
	// cross-compiled binaries (node:fs shims may fail on Windows builds).
	const content = await Bun.file(sourcePath).arrayBuffer();
	if (content.byteLength === 0) {
		throw new Error(`Failed to read embedded pict binary: ${sourcePath}`);
	}
	await Bun.write(tmpPath, content);

	if ((await Bun.file(tmpPath).size) === 0) {
		throw new Error(`Binary extraction failed — file is empty: ${tmpPath}`);
	}

	if (process.platform !== "win32") {
		try {
			chmodSync(tmpPath, 0o755);
		} catch {
			/* ignore */
		}
	}

	extractedBinaryPath = tmpPath;
	return tmpPath;
}

export async function runPict(
	model: PictModel,
	options: PictOptions,
): Promise<TestCase[]> {
	const binaryPath = await getPictBinaryPath();
	const modelContent = buildModelFile(model);
	const tmpPath = join(tmpdir(), `pict-${Date.now()}.txt`);

	await Bun.write(tmpPath, modelContent);

	const args: string[] = [binaryPath, tmpPath];
	if (options.order !== 2) args.push(`/o:${options.order}`);
	if (options.randomize) args.push("/r");
	if (options.caseSensitive) args.push("/c");

	let result: ReturnType<typeof Bun.spawnSync>;
	try {
		result = Bun.spawnSync(args);
	} catch (err) {
		throw new Error(
			`Failed to launch pict binary at "${binaryPath}". ` +
				`On Windows this can mean the Visual C++ 2015-2022 Redistributable is missing. ` +
				`Original error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	try {
		await unlink(tmpPath);
	} catch {
		/* ignore */
	}

	if (result.exitCode !== 0) {
		throw new Error(result.stderr?.toString() || "PICT execution failed");
	}

	return parseTsvOutput(result.stdout?.toString() ?? "");
}

function parseTsvOutput(output: string): TestCase[] {
	const lines = output.trim().split("\n");
	if (lines.length < 2) return [];

	const headers = (lines[0] ?? "").split("\t").map((h) => h.trim());
	const rows: TestCase[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;
		const values = line.split("\t");
		const row: TestCase = {};
		headers.forEach((h, idx) => {
			row[h] = values[idx]?.trim() ?? "";
		});
		rows.push(row);
	}

	return rows;
}
