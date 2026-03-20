import { chmodSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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

export function getPictBinaryPath(): string {
	if (extractedBinaryPath) return extractedBinaryPath;

	const sourcePath = process.platform === "win32" ? pictWinPath : pictLinuxPath;
	const ext = process.platform === "win32" ? ".exe" : "";
	const tmpPath = join(tmpdir(), `pairwise-tui-pict${ext}`);

	// sourcePath may be a /$bunfs/ virtual path (compiled binary) or a real
	// filesystem path (dev mode). readFileSync handles both cases in Bun.
	const content = readFileSync(sourcePath);
	writeFileSync(tmpPath, content);

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
	const binaryPath = getPictBinaryPath();
	const modelContent = buildModelFile(model);
	const tmpPath = `${tmpdir()}/pict-${Date.now()}.txt`;

	await Bun.write(tmpPath, modelContent);

	const args: string[] = [binaryPath, tmpPath];
	if (options.order !== 2) args.push(`/o:${options.order}`);
	if (options.randomize) args.push("/r");
	if (options.caseSensitive) args.push("/c");

	const result = Bun.spawnSync(args);

	try {
		unlinkSync(tmpPath);
	} catch {
		/* ignore */
	}

	if (result.exitCode !== 0) {
		throw new Error(result.stderr.toString() || "PICT execution failed");
	}

	return parseTsvOutput(result.stdout.toString());
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
