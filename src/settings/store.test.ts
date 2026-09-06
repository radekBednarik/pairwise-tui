import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, saveSettings } from "./store";

let dir: string;
const savedXdg = process.env.XDG_CONFIG_HOME;
const savedAppData = process.env.APPDATA;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-settings-test-"));
	process.env.XDG_CONFIG_HOME = dir;
	process.env.APPDATA = dir;
});

afterEach(async () => {
	process.env.XDG_CONFIG_HOME = savedXdg;
	process.env.APPDATA = savedAppData;
	await rm(dir, { recursive: true, force: true });
});

async function writeConfig(raw: string): Promise<void> {
	await Bun.write(join(dir, "pairwise-tui", "config.json"), raw);
}

test("missing config file yields the defaults", async () => {
	const s = await loadSettings();
	expect(s.options).toEqual({
		order: 2,
		randomize: false,
		caseSensitive: false,
	});
	expect(s.outputConfig).toEqual({ filePath: "./output.txt", format: "txt" });
	expect(s.modelStorage).toEqual({
		storagePath: "./",
		fileTemplate: "model_{timestamp}",
	});
	expect(s.themeName).toBe("tokyonight-dark");
	expect(s.aiModel).toBe("claude-haiku-4-5");
});

test("saved settings are read back unchanged", async () => {
	const settings = {
		options: { order: 3, randomize: true, caseSensitive: true },
		outputConfig: { filePath: "./cases.md", format: "md" as const },
		modelStorage: { storagePath: "/tmp", fileTemplate: "m_{timestamp}" },
		themeName: "tokyonight-storm",
		aiModel: "claude-opus-5" as const,
	};
	await saveSettings(settings);
	expect(await loadSettings()).toEqual(settings);
});

test("an unknown output format falls back to txt", async () => {
	await writeConfig(
		JSON.stringify({ outputConfig: { filePath: "./x.zip", format: "zip" } }),
	);
	const s = await loadSettings();
	expect(s.outputConfig.format).toBe("txt");
	expect(s.outputConfig.filePath).toBe("./x.zip");
});

test("an unknown ai model falls back to the default model", async () => {
	await writeConfig(JSON.stringify({ aiModel: "gpt-9" }));
	expect((await loadSettings()).aiModel).toBe("claude-haiku-4-5");
});

test("a combination order outside 1-6 falls back to 2", async () => {
	await writeConfig(JSON.stringify({ options: { order: 99 } }));
	expect((await loadSettings()).options.order).toBe(2);
});

test("a non-numeric combination order falls back to 2", async () => {
	await writeConfig(JSON.stringify({ options: { order: "three" } }));
	expect((await loadSettings()).options.order).toBe(2);
});

test("non-boolean toggles fall back to false", async () => {
	await writeConfig(
		JSON.stringify({ options: { randomize: "yes", caseSensitive: 1 } }),
	);
	const s = await loadSettings();
	expect(s.options.randomize).toBe(false);
	expect(s.options.caseSensitive).toBe(false);
});

test("sections that are not objects fall back to the defaults", async () => {
	await writeConfig(
		JSON.stringify({ options: "nope", outputConfig: 42, modelStorage: null }),
	);
	const s = await loadSettings();
	expect(s.options).toEqual({
		order: 2,
		randomize: false,
		caseSensitive: false,
	});
	expect(s.outputConfig).toEqual({ filePath: "./output.txt", format: "txt" });
	expect(s.modelStorage).toEqual({
		storagePath: "./",
		fileTemplate: "model_{timestamp}",
	});
});

test("non-string paths and theme name fall back to the defaults", async () => {
	await writeConfig(
		JSON.stringify({
			themeName: 7,
			outputConfig: { filePath: [] },
			modelStorage: { storagePath: {}, fileTemplate: false },
		}),
	);
	const s = await loadSettings();
	expect(s.themeName).toBe("tokyonight-dark");
	expect(s.outputConfig.filePath).toBe("./output.txt");
	expect(s.modelStorage).toEqual({
		storagePath: "./",
		fileTemplate: "model_{timestamp}",
	});
});

test("a JSON document that is not an object yields the defaults", async () => {
	await writeConfig('"just a string"');
	expect((await loadSettings()).themeName).toBe("tokyonight-dark");
});

test("a theme name that no theme uses falls back to the default theme", async () => {
	await writeConfig(JSON.stringify({ themeName: "solarized-banana" }));
	expect((await loadSettings()).themeName).toBe("tokyonight-dark");
});

test("a format name inherited from Object.prototype falls back to txt", async () => {
	await writeConfig(JSON.stringify({ outputConfig: { format: "toString" } }));
	expect((await loadSettings()).outputConfig.format).toBe("txt");
});
