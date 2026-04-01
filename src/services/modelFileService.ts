import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildModelFile, parseModelFile } from "../pict/model";
import type { ModelStorageConfig, PictModel } from "../types";

export async function saveModelToFile(
	model: PictModel,
	constraintsText: string,
	storage: ModelStorageConfig,
): Promise<string> {
	const modelToSave = { ...model, constraints: constraintsText };
	const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
	const filename = `${storage.fileTemplate.replace("{timestamp}", ts)}.txt`;
	const path = join(resolve(storage.storagePath), filename);
	await Bun.write(path, buildModelFile(modelToSave));
	return path;
}

export async function listModelFiles(
	storagePath: string,
): Promise<{ fp: string; mtime: number }[]> {
	const dir = resolve(storagePath);
	const entries = await readdir(dir);
	const txtFiles = entries.filter((e) => e.endsWith(".txt"));
	const withMtime = await Promise.all(
		txtFiles.map(async (name) => {
			const fp = join(dir, name);
			return { fp, mtime: (await stat(fp)).mtimeMs };
		}),
	);
	withMtime.sort((a, b) => b.mtime - a.mtime);
	return withMtime;
}

export async function loadModelFromFile(path: string): Promise<PictModel> {
	const content = await Bun.file(path).text();
	return parseModelFile(content);
}
