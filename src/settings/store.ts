import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { AI_MODELS, DEFAULT_AI_MODEL } from "../constants";
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
import { TIMESTAMP_PLACEHOLDER } from "../utils/fileTemplate";

export interface AppSettings {
	options: PictOptions;
	outputConfig: OutputConfig;
	modelStorage: ModelStorageConfig;
	themeName: string;
	aiModel: AiModel;
	promptOnGenerate: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
	options: { order: 2, randomize: false, caseSensitive: false },
	outputConfig: {
		filePath: `./output_${TIMESTAMP_PLACEHOLDER}.txt`,
		format: "txt",
	},
	modelStorage: {
		storagePath: "./",
		fileTemplate: `model_${TIMESTAMP_PLACEHOLDER}`,
	},
	themeName: "tokyonight-dark",
	aiModel: DEFAULT_AI_MODEL,
	promptOnGenerate: false,
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

// Models the app used to offer, mapped to the model that replaced them, so a
// saved choice survives the upgrade instead of silently resetting to default.
// A successor may later be retired too: add its own entry and leave the older
// ones alone, because resolveAiModel follows the chain.
const RETIRED_AI_MODELS: Record<string, string> = {
	"claude-opus-5": "claude-opus-5-5",
	"claude-sonnet-5": "claude-sonnet-5-5",
	"claude-haiku-4-5": "claude-haiku-5-5",
	"claude-fable-5-1": "claude-fable-5-2",
};

/**
 * Turns a saved model ID into one the app offers. Retired IDs are followed
 * to their current successor. Anything that doesn't end on an offered model,
 * including a cycle in the map, gives the fallback.
 */
export function resolveAiModel(
	value: unknown,
	fallback: AiModel,
	retired: Record<string, string> = RETIRED_AI_MODELS,
): AiModel {
	if (typeof value !== "string") return fallback;
	let model = value;
	// Each step follows one entry, so more steps than entries means a cycle.
	for (
		let steps = 0;
		Object.hasOwn(retired, model) && steps <= Object.keys(retired).length;
		steps++
	) {
		model = retired[model] as string;
	}
	return AI_MODELS.includes(model as AiModel) ? (model as AiModel) : fallback;
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
		aiModel: resolveAiModel(parsed.aiModel, defaults.aiModel),
		promptOnGenerate: asBoolean(
			parsed.promptOnGenerate,
			defaults.promptOnGenerate,
		),
	};
}

export async function saveSettings(settings: AppSettings): Promise<void> {
	const path = getConfigPath();
	await mkdir(dirname(path), { recursive: true });
	await Bun.write(path, JSON.stringify(settings, null, 2));
}
