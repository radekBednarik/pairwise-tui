export interface Parameter {
	name: string;
	values: string[];
}

export interface Submodel {
	paramNames: string[];
	order: number;
}

export interface PictModel {
	parameters: Parameter[];
	submodels: Submodel[];
	constraints: string;
}

export interface PictOptions {
	order: number;
	randomize: boolean;
	caseSensitive: boolean;
}

export interface OutputConfig {
	filePath: string;
	format: OutputFormat;
}

export type OutputFormat = "txt" | "json" | "csv" | "xlsx" | "md";

export interface ExportContext {
	headers: string[];
	rows: TestCase[];
	config: OutputConfig;
	model: PictModel;
	options: PictOptions;
}

export interface ModelStorageConfig {
	storagePath: string;
	fileTemplate: string;
}

export type AiModel =
	| "claude-haiku-4-5"
	| "claude-sonnet-4-6"
	| "claude-opus-4-8";

export const AI_MODEL_LABELS: Record<AiModel, string> = {
	"claude-haiku-4-5": "Haiku 4.5",
	"claude-sonnet-4-6": "Sonnet 4.6",
	"claude-opus-4-8": "Opus 4.8",
};

export type TestCase = Record<string, string>;

export type LogMessageType = "info" | "error";

export interface LogMessage {
	id: number;
	timestamp: Date;
	type: LogMessageType;
	text: string;
}
