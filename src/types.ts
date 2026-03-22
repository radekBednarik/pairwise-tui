export interface Parameter {
	name: string;
	values: string[];
}

export interface PictModel {
	parameters: Parameter[];
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

export type OutputFormat = "txt" | "json" | "csv" | "xlsx";

export interface ModelStorageConfig {
	storagePath: string;
	fileTemplate: string;
}

export type TestCase = Record<string, string>;

export type LogMessageType = "info" | "error";

export interface LogMessage {
	id: number;
	timestamp: Date;
	type: LogMessageType;
	text: string;
}
