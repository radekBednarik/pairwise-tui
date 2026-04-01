import type { ModalState } from "../useModalState";
import type { StatusLogState } from "../useStatusLog";
import type { KeyEvent } from "./types";

interface PickerActions {
	pickerFiles: string[];
	pickerIndex: number;
	closePicker: () => void;
	setPickerIndex: ModalState["setPickerIndex"];
	loadModelFromPath: (path: string) => Promise<void>;
}

export function handlePickerKeys(
	key: KeyEvent,
	actions: PickerActions,
): boolean {
	const { name } = key;
	if (name === "escape") {
		actions.closePicker();
		return true;
	}
	if (name === "up") {
		actions.setPickerIndex((i) => Math.max(0, i - 1));
		return true;
	}
	if (name === "down") {
		actions.setPickerIndex((i) =>
			Math.min(actions.pickerFiles.length - 1, i + 1),
		);
		return true;
	}
	if (name === "return") {
		const chosen = actions.pickerFiles[actions.pickerIndex];
		if (chosen) {
			actions.closePicker();
			void actions.loadModelFromPath(chosen);
		}
		return true;
	}
	return true; // swallow all other keys
}

interface DocsActions {
	docsView: "list" | "chapter";
	setDocsOpen: ModalState["setDocsOpen"];
	setDocsView: ModalState["setDocsView"];
	setDocsChapterIdx: ModalState["setDocsChapterIdx"];
	setDocsScrollOffset: ModalState["setDocsScrollOffset"];
	docChapterCount: number;
}

export function handleDocsKeys(key: KeyEvent, actions: DocsActions): boolean {
	const { name } = key;
	if (actions.docsView === "list") {
		if (name === "escape") {
			actions.setDocsOpen(false);
			actions.setDocsView("list");
			return true;
		}
		if (name === "up") {
			actions.setDocsChapterIdx((i) => Math.max(0, i - 1));
			return true;
		}
		if (name === "down") {
			actions.setDocsChapterIdx((i) =>
				Math.min(actions.docChapterCount - 1, i + 1),
			);
			return true;
		}
		if (name === "return") {
			actions.setDocsScrollOffset(0);
			actions.setDocsView("chapter");
			return true;
		}
	} else {
		if (name === "escape") {
			actions.setDocsView("list");
			return true;
		}
		if (name === "up") {
			actions.setDocsScrollOffset((o) => Math.max(0, o - 1));
			return true;
		}
		if (name === "down") {
			actions.setDocsScrollOffset((o) => o + 1);
			return true;
		}
	}
	return true; // swallow all other keys while docs open
}

interface LogActions {
	logMessages: StatusLogState["logMessages"];
	logSelectedIndex: StatusLogState["logSelectedIndex"];
	setLogOpen: StatusLogState["setLogOpen"];
	setLogSelectedIndex: StatusLogState["setLogSelectedIndex"];
	setLogScrollOffset: StatusLogState["setLogScrollOffset"];
	showStatus: StatusLogState["showStatus"];
	formatLogEntry: StatusLogState["formatLogEntry"];
	copyToClipboard: (text: string) => boolean;
}

export function handleLogKeys(key: KeyEvent, actions: LogActions): boolean {
	const { name } = key;
	if (name === "escape" || name === "m") {
		actions.setLogOpen(false);
		return true;
	}
	if (name === "up") {
		actions.setLogSelectedIndex((i) => Math.max(0, i - 1));
		actions.setLogScrollOffset((o) => Math.max(0, o - 1));
		return true;
	}
	if (name === "down") {
		actions.setLogSelectedIndex((i) =>
			Math.min(actions.logMessages.length - 1, i + 1),
		);
		actions.setLogScrollOffset((o) => o + 1);
		return true;
	}
	if (name === "c") {
		const msg = actions.logMessages[actions.logSelectedIndex];
		if (msg) {
			const ok = actions.copyToClipboard(actions.formatLogEntry(msg));
			actions.showStatus(
				ok
					? "Copied to clipboard"
					: "Copy failed — install wl-clipboard or xclip",
				!ok,
			);
		}
		return true;
	}
	if (name === "a") {
		const ok = actions.copyToClipboard(
			actions.logMessages.map(actions.formatLogEntry).join("\n"),
		);
		actions.showStatus(
			ok
				? "Copied all entries to clipboard"
				: "Copy failed — install wl-clipboard or xclip",
			!ok,
		);
		return true;
	}
	return true; // swallow all other keys
}

interface ClearConfirmActions {
	clearConfirmIndex: ModalState["clearConfirmIndex"];
	setClearConfirmIndex: ModalState["setClearConfirmIndex"];
	closeClearConfirm: ModalState["closeClearConfirm"];
	clearModel: () => void;
}

export function handleClearConfirmKeys(
	key: KeyEvent,
	actions: ClearConfirmActions,
): boolean {
	const { name } = key;
	if (
		name === "escape" ||
		(name === "return" && actions.clearConfirmIndex === 1)
	) {
		actions.closeClearConfirm();
		return true;
	}
	if (name === "up" || name === "down") {
		actions.setClearConfirmIndex((i) => (i === 0 ? 1 : 0));
		return true;
	}
	if (name === "return" && actions.clearConfirmIndex === 0) {
		actions.clearModel();
		actions.closeClearConfirm();
		return true;
	}
	return true; // swallow all other keys
}

interface AiSetupActions {
	closeAiSetup: ModalState["closeAiSetup"];
	handleClearApiKey: () => void;
}

export function handleAiSetupKeys(
	key: KeyEvent,
	actions: AiSetupActions,
): boolean {
	const { name } = key;
	if (name === "escape") {
		actions.closeAiSetup();
		return true;
	}
	if (name === "d") {
		actions.handleClearApiKey();
		return true;
	}
	return true; // <input> handles typing; Enter via onSubmit
}

interface AiPromptActions {
	aiIsLoading: boolean;
	closeAiPrompt: ModalState["closeAiPrompt"];
	handleAiGenerate: () => void;
}

export function handleAiPromptKeys(
	key: KeyEvent,
	actions: AiPromptActions,
): boolean {
	const { name, ctrl } = key;
	if (name === "escape") {
		if (!actions.aiIsLoading) {
			actions.closeAiPrompt();
		}
		return true;
	}
	if (ctrl && name === "g" && !actions.aiIsLoading) {
		actions.handleAiGenerate();
		return true;
	}
	return true; // textarea handles all other keys
}
