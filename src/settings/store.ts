import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { AI_MODELS } from "../constants";
import { FORMAT_EXTENSIONS } from "../output/writer";
import { THEME_NAMES } from "../theme/themes";
import type {
	AiModel,
	ModelStorageConfig,
	OutputConfig,
	OutputFormat,
	PictOptions,
} from "../types";
import { getAppConfigPath } from "../utils/configPath";

export interface AppSettings {
	options: PictOptions;
	outputConfig: OutputConfig;
	modelStorage: ModelStorageConfig;
	themeName: string;
	aiModel: AiModel;
}

const DEFAULT_SETTINGS: AppSettings = {
	options: { order: 2, randomize: false, caseSensitive: false },
	outputConfig: { filePath: "./output.txt", format: "txt" },
	modelStorage: { storagePath: "./", fileTemplate: "model_{timestamp}" },
	themeName: "tokyonight-dark",
	aiModel: "claude-haiku-4-5",
};

const MIN_ORDER = 1;
const MAX_ORDER = 6;

function getConfigPath(): string {
	return getAppConfigPath("config.json");
}

type Unknown = Record<string, unknown>;

function asObject(value: unknown): Unknown {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Unknown)
		: {};
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function asOrder(value: unknown, fallback: number): number {
	return typeof value === "number" &&
		Number.isInteger(value) &&
		value >= MIN_ORDER &&
		value <= MAX_ORDER
		? value
		: fallback;
}

function asFormat(value: unknown, fallback: OutputFormat): OutputFormat {
	return typeof value === "string" && Object.hasOwn(FORMAT_EXTENSIONS, value)
		? (value as OutputFormat)
		: fallback;
}

function asThemeName(value: unknown, fallback: string): string {
	return typeof value === "string" && THEME_NAMES.includes(value)
		? value
		: fallback;
}

function asAiModel(value: unknown, fallback: AiModel): AiModel {
	return AI_MODELS.includes(value as AiModel) ? (value as AiModel) : fallback;
}

// The config file is user-editable, so every field is re-validated on the way
// in: a bad value falls back to its default instead of reaching the UI.
export async function loadSettings(): Promise<AppSettings> {
	let parsed: Unknown;
	try {
		parsed = asObject(JSON.parse(await Bun.file(getConfigPath()).text()));
	} catch {
		return structuredClone(DEFAULT_SETTINGS);
	}

	const defaults = DEFAULT_SETTINGS;
	const options = asObject(parsed.options);
	const outputConfig = asObject(parsed.outputConfig);
	const modelStorage = asObject(parsed.modelStorage);

	return {
		options: {
			order: asOrder(options.order, defaults.options.order),
			randomize: asBoolean(options.randomize, defaults.options.randomize),
			caseSensitive: asBoolean(
				options.caseSensitive,
				defaults.options.caseSensitive,
			),
		},
		outputConfig: {
			filePath: asString(outputConfig.filePath, defaults.outputConfig.filePath),
			format: asFormat(outputConfig.format, defaults.outputConfig.format),
		},
		modelStorage: {
			storagePath: asString(
				modelStorage.storagePath,
				defaults.modelStorage.storagePath,
			),
			fileTemplate: asString(
				modelStorage.fileTemplate,
				defaults.modelStorage.fileTemplate,
			),
		},
		themeName: asThemeName(parsed.themeName, defaults.themeName),
		aiModel: asAiModel(parsed.aiModel, defaults.aiModel),
	};
}

export async function saveSettings(settings: AppSettings): Promise<void> {
	const path = getConfigPath();
	await mkdir(dirname(path), { recursive: true });
	await Bun.write(path, JSON.stringify(settings, null, 2));
}
