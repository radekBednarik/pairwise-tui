import type { Dispatch, SetStateAction } from "react";
import type { ActiveOptionField, ActivePanel } from "../../constants";
import type { StatusLogState } from "../useStatusLog";
import type { KeyEvent } from "./types";

interface GlobalActions {
	activeTab: number;
	themeName: string;
	themeNames: string[];
	defaultThemeName: string;
	isGenerating: boolean;
	logMessages: StatusLogState["logMessages"];
	setActiveTab: (tab: number) => void;
	setThemeName: (name: string) => void;
	showStatus: StatusLogState["showStatus"];
	setLogOpen: StatusLogState["setLogOpen"];
	setLogSelectedIndex: StatusLogState["setLogSelectedIndex"];
	setLogScrollOffset: StatusLogState["setLogScrollOffset"];
	setDocsOpen: (v: boolean) => void;
	setDocsView: (v: "list" | "chapter") => void;
	openAiSetup: () => void;
	openAiPrompt: () => void;
	apiKey: string | null;
	handleGenerate: () => Promise<void>;
	handleSaveResults: () => Promise<void>;
	handleOpenModel: () => Promise<void>;
	handleSaveModel: () => Promise<void>;
	destroy: () => void;
	// Escape handling
	activePanel: ActivePanel;
	activeOptionField: ActiveOptionField;
	cancelAddParam: () => void;
	cancelAddSubmodel: () => void;
	setActivePanel: (panel: ActivePanel) => void;
	setActiveOptionField: Dispatch<SetStateAction<ActiveOptionField>>;
}

export function handleEscapeKey(actions: GlobalActions): boolean {
	if (actions.activePanel === "adding") {
		actions.cancelAddParam();
		return true;
	}
	if (actions.activePanel === "submodel-adding") {
		actions.cancelAddSubmodel();
		return true;
	}
	if (
		actions.activeTab === 0 &&
		(actions.activePanel === "values" ||
			actions.activePanel === "constraints" ||
			actions.activePanel === "submodels")
	) {
		actions.setActivePanel("params");
		return true;
	}
	if (actions.activeTab === 1 && actions.activeOptionField !== "none") {
		actions.setActiveOptionField("none");
		return true;
	}
	return true;
}

export function handleGlobalKeys(
	key: KeyEvent,
	actions: GlobalActions,
): boolean {
	const { name } = key;
	if (name === "m") {
		actions.setLogOpen(true);
		actions.setLogSelectedIndex(Math.max(0, actions.logMessages.length - 1));
		actions.setLogScrollOffset(Math.max(0, actions.logMessages.length - 1));
		return true;
	}
	if (name === "?") {
		actions.setDocsOpen(true);
		actions.setDocsView("list");
		return true;
	}
	if (name === "q") {
		actions.destroy();
		return true;
	}
	if (name === "g" && !actions.isGenerating) {
		void actions.handleGenerate();
		return true;
	}
	if (name === "s") {
		void actions.handleSaveResults();
		return true;
	}
	if (name === "o") {
		void actions.handleOpenModel();
		return true;
	}
	if (name === "w") {
		void actions.handleSaveModel();
		return true;
	}
	if (name === "t") {
		const idx = actions.themeNames.indexOf(actions.themeName);
		const newThemeName =
			actions.themeNames[(idx + 1) % actions.themeNames.length] ??
			actions.defaultThemeName;
		actions.setThemeName(newThemeName);
		actions.showStatus(`Theme: ${newThemeName}`);
		return true;
	}
	if (name === "i") {
		if (actions.apiKey) {
			actions.openAiPrompt();
		} else {
			actions.openAiSetup();
		}
		return true;
	}
	return false;
}

export function handleTabSwitchKeys(
	key: KeyEvent,
	actions: { activeTab: number; setActiveTab: (tab: number) => void },
): boolean {
	const { name } = key;
	if (name === "1") {
		actions.setActiveTab(0);
		return true;
	}
	if (name === "2") {
		actions.setActiveTab(1);
		return true;
	}
	if (name === "3") {
		actions.setActiveTab(2);
		return true;
	}
	if (name === "[") {
		actions.setActiveTab((actions.activeTab - 1 + 3) % 3);
		return true;
	}
	if (name === "]") {
		actions.setActiveTab((actions.activeTab + 1) % 3);
		return true;
	}
	return false;
}
