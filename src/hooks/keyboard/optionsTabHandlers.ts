import type { Dispatch, SetStateAction } from "react";
import type { ActiveOptionField } from "../../constants";
import type {
	AiModel,
	OutputConfig,
	OutputFormat,
	PictOptions,
} from "../../types";
import type { KeyEvent } from "./types";

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
			const formats: OutputFormat[] = ["txt", "json", "csv", "xlsx"];
			const next =
				formats[
					(formats.indexOf(actions.outputConfig.format) + 1) % formats.length
				] ?? "txt";
			const base = actions.outputConfig.filePath.replace(/\.[^.]+$/, "");
			actions.setOutputConfig({
				format: next,
				filePath: `${base}${actions.formatExtensions[next]}`,
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
