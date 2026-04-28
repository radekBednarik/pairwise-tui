import type { ModelTabState } from "../useModelTabState";
import type { KeyEvent } from "./types";

interface ModelTabActions {
	setActivePanel: ModelTabState["setActivePanel"];
	handleDeleteParam: ModelTabState["handleDeleteParam"];
	openClearConfirm: () => void;
}

interface SubmodelActions {
	startAddSubmodel: ModelTabState["startAddSubmodel"];
	handleDeleteSubmodel: ModelTabState["handleDeleteSubmodel"];
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
	if (name === "b") {
		actions.setActivePanel("submodels");
		return true;
	}
	if (name === "x") {
		actions.openClearConfirm();
		return true;
	}
	return true; // swallow other keys in params panel
}

export function handleModelTabSubmodelKeys(
	key: KeyEvent,
	actions: SubmodelActions,
): boolean {
	const { name } = key;
	if (name === "a") {
		actions.startAddSubmodel();
		return true;
	}
	if (name === "d") {
		actions.handleDeleteSubmodel();
		return true;
	}
	return true; // swallow — Up/Down handled by focused <select> via onChange
}
