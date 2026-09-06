import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
// Embedded at compile time — Bun extracts to a temp path at runtime
// @ts-expect-error - Bun file asset embedding
import pictLinuxPath from "../../binaries/pict" with { type: "file" };
// @ts-expect-error - Bun file asset embedding
import pictWinPath from "../../binaries/pict.exe" with { type: "file" };
import type { PictModel, PictOptions, TestCase } from "../types";
import { buildModelFile } from "./model";

const DIR_MODE = 0o700;

let extractedBinaryPath: string | null = null;

/**
 * The extracted binary is executed and the model file is handed to it, so both
 * live in a directory that only this user can enter. A shared temp directory
 * would let another local user swap either file between our write and our
 * spawn, or plant a symlink at the path we are about to write.
 */
async function getExtractionDir(): Promise<string> {
	const uid = typeof process.getuid === "function" ? process.getuid() : null;
	const dir = join(
		tmpdir(),
		uid === null ? "pairwise-tui" : `pairwise-tui-${uid}`,
	);
	await mkdir(dir, { recursive: true, mode: DIR_MODE });

	// Windows temp directories are already per-user and report POSIX modes that
	// mean nothing, so these checks only apply elsewhere.
	if (process.platform !== "win32") {
		const info = await lstat(dir);
		if (!info.isDirectory()) {
			throw new Error(`Temp path is not a directory: ${dir}`);
		}
		if (uid !== null && info.uid !== uid) {
			throw new Error(
				`Refusing to use temp directory owned by another user: ${dir}`,
			);
		}
		// mkdir applies its mode only when it creates the directory.
		if ((info.mode & 0o077) !== 0) {
			await chmod(dir, DIR_MODE);
		}
	}

	return dir;
}

export async function getPictBinaryPath(): Promise<string> {
	const ext = process.platform === "win32" ? ".exe" : "";
	const tmpPath = join(await getExtractionDir(), `pairwise-tui-pict${ext}`);

	// Re-extract if the cached copy was cleaned up underneath us.
	if (extractedBinaryPath === tmpPath && (await Bun.file(tmpPath).exists())) {
		return tmpPath;
	}

	const sourcePath = process.platform === "win32" ? pictWinPath : pictLinuxPath;

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
			await chmod(tmpPath, 0o755);
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
	const tmpPath = join(dirname(binaryPath), `pict-${randomUUID()}.txt`);

	await Bun.write(tmpPath, modelContent);

	try {
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

		if (result.exitCode !== 0) {
			throw new Error(result.stderr?.toString() || "PICT execution failed");
		}

		return parseTsvOutput(result.stdout?.toString() ?? "");
	} finally {
		await unlink(tmpPath).catch(() => {});
	}
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
