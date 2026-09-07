import type { Dispatch, SetStateAction } from "react";
import type { ActiveOptionField } from "../../constants";
import type {
	AiModel,
	OutputConfig,
	OutputFormat,
	PictOptions,
} from "../../types";
import type { KeyEvent } from "./types";

// Swaps the extension on the file name only: a dot inside a directory
// ("out.d/cases") or a name with no extension at all ("cases_{timestamp}")
// must survive untouched.
function withExtension(filePath: string, extension: string): string {
	const cut = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	const dir = filePath.slice(0, cut + 1);
	const name = filePath.slice(cut + 1);
	const base = name.replace(/\.[^.]+$/, "") || "output";
	return `${dir}${base}${extension}`;
}

interface OptionsTabActions {
	activeOptionField: ActiveOptionField;
	outputConfig: OutputConfig;
	options: PictOptions;
	aiModel: AiModel;
	aiModels: AiModel[];
	optionFields: ActiveOptionField[];
	formatExtensions: Record<OutputFormat, string>;
	setActiveOptionField: Dispatch<SetStateAction<ActiveOptionField>>;
	setOutputConfig: (cfg: OutputConfig) => void;
	setOptions: Dispatch<SetStateAction<PictOptions>>;
	setAiModel: (model: AiModel) => void;
}

export function handleOptionsTabKeys(
	key: KeyEvent,
	actions: OptionsTabActions,
): boolean {
	const { name } = key;
	if (name === "return") {
		if (actions.activeOptionField === "format") {
			// Single source of truth — a new format added to FORMAT_EXTENSIONS
			// joins the cycle automatically.
			const formats = Object.keys(actions.formatExtensions) as OutputFormat[];
			const next =
				formats[
					(formats.indexOf(actions.outputConfig.format) + 1) % formats.length
				] ?? "txt";
			actions.setOutputConfig({
				format: next,
				filePath: withExtension(
					actions.outputConfig.filePath,
					actions.formatExtensions[next],
				),
			});
			return true;
		}
		if (actions.activeOptionField === "randomize") {
			actions.setOptions((o) => ({ ...o, randomize: !o.randomize }));
			return true;
		}
		if (actions.activeOptionField === "caseSensitive") {
			actions.setOptions((o) => ({ ...o, caseSensitive: !o.caseSensitive }));
			return true;
		}
		if (actions.activeOptionField === "aiModel") {
			const next =
				actions.aiModels[
					(actions.aiModels.indexOf(actions.aiModel) + 1) %
						actions.aiModels.length
				] ?? "claude-haiku-4-5";
			actions.setAiModel(next);
			return true;
		}
	}
	return false;
}
