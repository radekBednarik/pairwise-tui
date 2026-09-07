import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { PictModel } from "../types";
import { loadModelFromFile, saveModelToFile } from "./modelFileService";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-model-test-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const model: PictModel = {
	parameters: [{ name: "OS", values: ["win", "linux"] }],
	submodels: [],
	constraints: "",
};

test("the saved model file name expands {timestamp}", async () => {
	const path = await saveModelToFile(model, "", {
		storagePath: dir,
		fileTemplate: "model_{timestamp}",
	});
	expect(basename(path)).toMatch(
		/^model_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.pictm$/,
	);
	expect(await Bun.file(path).exists()).toBe(true);
});

test("every {timestamp} in the template is expanded", async () => {
	const path = await saveModelToFile(model, "", {
		storagePath: dir,
		fileTemplate: "{timestamp}_model_{timestamp}",
	});
	expect(basename(path)).not.toContain("{timestamp}");
});

test("a saved model round-trips through the written file", async () => {
	const path = await saveModelToFile(
		model,
		'IF [OS] = "win" THEN [OS] <> "linux";',
		{
			storagePath: dir,
			fileTemplate: "rt_{timestamp}",
		},
	);
	const loaded = await loadModelFromFile(path);
	expect(loaded.parameters).toEqual(model.parameters);
	expect(loaded.constraints).toContain("IF [OS]");
});
