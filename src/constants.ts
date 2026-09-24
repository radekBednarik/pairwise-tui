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
	| "promptOnGenerate"
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
	"promptOnGenerate",
	"order",
	"randomize",
	"caseSensitive",
	"storagePath",
	"fileTemplate",
	"aiModel",
	"none",
];

export const AI_MODELS: AiModel[] = [
	"claude-sonnet-5",
	"claude-opus-5-5",
	"claude-fable-5-1",
];

export const DEFAULT_AI_MODEL: AiModel = "claude-sonnet-5";

/** The field Tab moves to from `field`, wrapping after the last one. */
export function nextOptionField(field: ActiveOptionField): ActiveOptionField {
	const idx = OPTION_FIELDS.indexOf(field);
	return OPTION_FIELDS[(idx + 1) % OPTION_FIELDS.length] ?? "none";
}
