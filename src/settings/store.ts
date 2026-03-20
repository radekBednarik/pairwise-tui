import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OutputConfig, PictOptions } from "../types";

export interface AppSettings {
	options: PictOptions;
	outputConfig: OutputConfig;
}

const DEFAULT_SETTINGS: AppSettings = {
	options: { order: 2, randomize: false, caseSensitive: false },
	outputConfig: { filePath: "./output.txt", format: "txt" },
};

function getConfigPath(): string {
	if (process.platform === "win32") {
		const appData =
			process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
		return join(appData, "pairwise-tui", "config.json");
	}
	const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
	return join(xdgConfig, "pairwise-tui", "config.json");
}

export async function loadSettings(): Promise<AppSettings> {
	try {
		const text = await Bun.file(getConfigPath()).text();
		const parsed = JSON.parse(text);
		return {
			options: { ...DEFAULT_SETTINGS.options, ...parsed.options },
			outputConfig: {
				...DEFAULT_SETTINGS.outputConfig,
				...parsed.outputConfig,
			},
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export async function saveSettings(settings: AppSettings): Promise<void> {
	const path = getConfigPath();
	const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	const dir = path.substring(0, lastSep);
	await mkdir(dir, { recursive: true });
	await Bun.write(path, JSON.stringify(settings, null, 2));
}
