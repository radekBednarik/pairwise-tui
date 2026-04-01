import type { ModelTabState } from "../useModelTabState";
import type { KeyEvent } from "./types";

interface ModelTabActions {
	setActivePanel: ModelTabState["setActivePanel"];
	handleDeleteParam: ModelTabState["handleDeleteParam"];
	openClearConfirm: () => void;
}

export function handleModelTabParamKeys(
	key: KeyEvent,
	actions: ModelTabActions,
): boolean {
	const { name } = key;
	if (name === "a") {
		actions.setActivePanel("adding");
		return true;
	}
	if (name === "d") {
		actions.handleDeleteParam();
		return true;
	}
	if (name === "e") {
		actions.setActivePanel("values");
		return true;
	}
	if (name === "c") {
		actions.setActivePanel("constraints");
		return true;
	}
	if (name === "x") {
		actions.openClearConfirm();
		return true;
	}
	return true; // swallow other keys in params panel
}
