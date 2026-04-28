import type { AiModel } from "./types";

export type ActivePanel =
	| "params"
	| "values"
	| "constraints"
	| "adding"
	| "submodels"
	| "submodel-adding";

export type ActiveOptionField =
	| "filepath"
	| "format"
	| "order"
	| "randomize"
	| "caseSensitive"
	| "storagePath"
	| "fileTemplate"
	| "aiModel"
	| "none";

export const TAB_OPTIONS = [
	{ name: "Model", description: "Define parameters and constraints" },
	{ name: "Options", description: "Configure PICT and output" },
	{ name: "Results", description: "View generated test cases" },
];

export const OPTION_FIELDS: ActiveOptionField[] = [
	"filepath",
	"format",
	"order",
	"randomize",
	"caseSensitive",
	"storagePath",
	"fileTemplate",
	"aiModel",
	"none",
];

export const AI_MODELS: AiModel[] = [
	"claude-haiku-4-5",
	"claude-sonnet-4-6",
	"claude-opus-4-6",
];
