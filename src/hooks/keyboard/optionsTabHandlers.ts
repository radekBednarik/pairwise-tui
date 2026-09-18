import type { Dispatch, SetStateAction } from "react";
import type { ActiveOptionField } from "../../constants";
import type {
	AiModel,
	OutputConfig,
	OutputFormat,
	PictOptions,
} from "../../types";
import { cycleFormat, withExtension } from "../../utils/outputPath";
import type { KeyEvent } from "./types";

interface OptionsTabActions {
	activeOptionField: ActiveOptionField;
	outputConfig: OutputConfig;
	options: PictOptions;
	aiModel: AiModel;
	aiModels: AiModel[];
	formatExtensions: Record<OutputFormat, string>;
	promptOnGenerate: boolean;
	setActiveOptionField: Dispatch<SetStateAction<ActiveOptionField>>;
	setOutputConfig: (cfg: OutputConfig) => void;
	setOptions: Dispatch<SetStateAction<PictOptions>>;
	setAiModel: (model: AiModel) => void;
	setPromptOnGenerate: (v: boolean) => void;
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
			const next = cycleFormat(
				actions.outputConfig.format,
				1,
				actions.formatExtensions,
			);
			actions.setOutputConfig({
				format: next,
				filePath: withExtension(
					actions.outputConfig.filePath,
					actions.formatExtensions[next],
				),
			});
			return true;
		}
		if (actions.activeOptionField === "promptOnGenerate") {
			actions.setPromptOnGenerate(!actions.promptOnGenerate);
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
