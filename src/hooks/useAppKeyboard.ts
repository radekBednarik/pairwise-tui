import { useKeyboard } from "@opentui/react";
import type { Dispatch, SetStateAction } from "react";
import type { ActiveOptionField } from "../constants";
import { AI_MODELS, OPTION_FIELDS } from "../constants";
import { DOC_CHAPTERS } from "../docs/pict-docs";
import { FORMAT_EXTENSIONS } from "../output/writer";
import { DEFAULT_THEME_NAME, THEME_NAMES } from "../theme/themes";
import type {
	ModelStorageConfig,
	OutputConfig,
	PictOptions,
	TestCase,
} from "../types";
import { copyToClipboard } from "../utils/clipboard";
import {
	handleEscapeKey,
	handleGlobalKeys,
	handleTabSwitchKeys,
} from "./keyboard/globalHandlers";
import {
	handleAiPromptKeys,
	handleAiSetupKeys,
	handleClearConfirmKeys,
	handleDocsKeys,
	handleLogKeys,
	handlePickerKeys,
} from "./keyboard/modalHandlers";
import {
	handleModelTabParamKeys,
	handleModelTabSubmodelKeys,
} from "./keyboard/modelTabHandlers";
import { handleOptionsTabKeys } from "./keyboard/optionsTabHandlers";
import type { AiState } from "./useAiState";
import type { ModalState } from "./useModalState";
import type { ModelTabState } from "./useModelTabState";
import type { StatusLogState } from "./useStatusLog";

export interface AppKeyboardParams {
	renderer: { destroy: () => void };
	activeTab: number;
	setActiveTab: (tab: number) => void;
	activeOptionField: ActiveOptionField;
	setActiveOptionField: Dispatch<SetStateAction<ActiveOptionField>>;
	themeName: string;
	setThemeName: (name: string) => void;
	isGenerating: boolean;
	outputConfig: OutputConfig;
	setOutputConfig: (cfg: OutputConfig) => void;
	options: PictOptions;
	setOptions: Dispatch<SetStateAction<PictOptions>>;
	modelStorage: ModelStorageConfig;
	results: TestCase[];
	log: StatusLogState;
	modal: ModalState;
	ai: AiState;
	modelTab: ModelTabState;
	handleGenerate: () => Promise<void>;
	handleSaveResults: () => Promise<void>;
	handleOpenModel: () => Promise<void>;
	handleSaveModel: () => Promise<void>;
	handleClearApiKey: () => void;
	handleAiGenerate: () => void;
	loadModelFromPath: (path: string) => Promise<void>;
	clearModel: () => void;
}

export function useAppKeyboard(params: AppKeyboardParams): void {
	const {
		renderer,
		activeTab,
		setActiveTab,
		activeOptionField,
		setActiveOptionField,
		themeName,
		setThemeName,
		isGenerating,
		outputConfig,
		setOutputConfig,
		options,
		setOptions,
		log,
		modal,
		ai,
		modelTab,
		handleGenerate,
		handleSaveResults,
		handleOpenModel,
		handleSaveModel,
		handleClearApiKey,
		handleAiGenerate,
		loadModelFromPath,
		clearModel,
	} = params;

	useKeyboard((key) => {
		const { name, ctrl } = key;

		// Always: quit via Ctrl+C
		if (ctrl && name === "c") {
			renderer.destroy();
			return;
		}

		// F2: open AI setup from anywhere (safe in text inputs — not a character)
		if (name === "f2" && !modal.aiSetupOpen) {
			modal.openAiSetup();
			return;
		}

		// File picker intercept
		if (modal.pickerOpen) {
			handlePickerKeys(key, {
				pickerFiles: modal.pickerFiles,
				pickerIndex: modal.pickerIndex,
				closePicker: modal.closePicker,
				setPickerIndex: modal.setPickerIndex,
				loadModelFromPath,
			});
			return;
		}

		// Docs overlay intercept
		if (modal.docsOpen) {
			handleDocsKeys(key, {
				docsView: modal.docsView,
				setDocsOpen: modal.setDocsOpen,
				setDocsView: modal.setDocsView,
				setDocsChapterIdx: modal.setDocsChapterIdx,
				setDocsScrollOffset: modal.setDocsScrollOffset,
				docChapterCount: DOC_CHAPTERS.length,
			});
			return;
		}

		// Message log overlay intercept
		if (log.logOpen) {
			handleLogKeys(key, {
				logMessages: log.logMessages,
				logSelectedIndex: log.logSelectedIndex,
				setLogOpen: log.setLogOpen,
				setLogSelectedIndex: log.setLogSelectedIndex,
				setLogScrollOffset: log.setLogScrollOffset,
				showStatus: log.showStatus,
				formatLogEntry: log.formatLogEntry,
				copyToClipboard: (text) =>
					copyToClipboard(
						text,
						renderer as Parameters<typeof copyToClipboard>[1],
					),
			});
			return;
		}

		// Clear confirm overlay intercept
		if (modal.showClearConfirm) {
			handleClearConfirmKeys(key, {
				clearConfirmIndex: modal.clearConfirmIndex,
				setClearConfirmIndex: modal.setClearConfirmIndex,
				closeClearConfirm: modal.closeClearConfirm,
				clearModel,
			});
			return;
		}

		// AI setup overlay intercept
		if (modal.aiSetupOpen) {
			handleAiSetupKeys(key, {
				closeAiSetup: modal.closeAiSetup,
				handleClearApiKey,
			});
			return;
		}

		// AI prompt overlay intercept
		if (modal.aiPromptOpen) {
			handleAiPromptKeys(key, {
				aiIsLoading: modal.aiIsLoading,
				closeAiPrompt: modal.closeAiPrompt,
				handleAiGenerate,
			});
			return;
		}

		// Escape: exit current input mode
		if (name === "escape") {
			handleEscapeKey({
				activeTab,
				activePanel: modelTab.activePanel,
				activeOptionField,
				cancelAddParam: modelTab.cancelAddParam,
				cancelAddSubmodel: modelTab.cancelAddSubmodel,
				submodelDropdownFocused: modelTab.submodelDropdownFocused,
				cancelSubmodelDropdown: modelTab.cancelSubmodelDropdown,
				setActivePanel: modelTab.setActivePanel,
				setActiveOptionField,
				themeName,
				themeNames: THEME_NAMES,
				defaultThemeName: DEFAULT_THEME_NAME,
				isGenerating,
				logMessages: log.logMessages,
				setActiveTab,
				setThemeName,
				showStatus: log.showStatus,
				setLogOpen: log.setLogOpen,
				setLogSelectedIndex: log.setLogSelectedIndex,
				setLogScrollOffset: log.setLogScrollOffset,
				setDocsOpen: modal.setDocsOpen,
				setDocsView: modal.setDocsView,
				openAiSetup: modal.openAiSetup,
				openAiPrompt: modal.openAiPrompt,
				apiKey: ai.apiKey,
				handleGenerate,
				handleSaveResults,
				handleOpenModel,
				handleSaveModel,
				destroy: renderer.destroy,
			});
			return;
		}

		// Adding param: all keys handled by <input> (Enter via onSubmit)
		if (modelTab.activePanel === "adding") {
			return;
		}

		// Adding submodel (two-step): all keys handled by <input> (Enter via onSubmit)
		if (modelTab.activePanel === "submodel-adding") {
			if (
				name === "down" &&
				modelTab.submodelAddingStep === "params" &&
				!modelTab.submodelDropdownFocused &&
				modelTab.submodelDropdownOptions.length > 0
			) {
				modelTab.handleSubmodelDropdownFocus();
			}
			return;
		}

		// Quit always works, even while in text editing panels
		if (name === "q") {
			renderer.destroy();
			return;
		}

		// Values panel: Escape handled above; all other keys go to <input>
		if (activeTab === 0 && modelTab.activePanel === "values") {
			return;
		}

		// Constraints panel: Escape handled above; all other keys go to <textarea>
		if (activeTab === 0 && modelTab.activePanel === "constraints") {
			return;
		}

		// Options text fields: keys go to <input>
		if (
			activeTab === 1 &&
			(activeOptionField === "filepath" ||
				activeOptionField === "order" ||
				activeOptionField === "storagePath" ||
				activeOptionField === "fileTemplate")
		) {
			if (name === "tab") {
				const idx = OPTION_FIELDS.indexOf(activeOptionField);
				setActiveOptionField(
					OPTION_FIELDS[(idx + 1) % OPTION_FIELDS.length] ?? "none",
				);
			}
			return;
		}

		// --- Not in text editing mode from here ---

		// Tab key for panel/field cycling
		if (name === "tab") {
			if (activeTab === 0 && modelTab.activePanel === "params") {
				modelTab.setActivePanel("values");
				return;
			}
			if (activeTab === 1) {
				const idx = OPTION_FIELDS.indexOf(activeOptionField);
				setActiveOptionField(
					OPTION_FIELDS[(idx + 1) % OPTION_FIELDS.length] ?? "none",
				);
				return;
			}
			return;
		}

		// Switch tabs
		if (handleTabSwitchKeys(key, { activeTab, setActiveTab })) return;

		// Global actions
		if (
			handleGlobalKeys(key, {
				activeTab,
				themeName,
				themeNames: THEME_NAMES,
				defaultThemeName: DEFAULT_THEME_NAME,
				isGenerating,
				logMessages: log.logMessages,
				setActiveTab,
				setThemeName,
				showStatus: log.showStatus,
				setLogOpen: log.setLogOpen,
				setLogSelectedIndex: log.setLogSelectedIndex,
				setLogScrollOffset: log.setLogScrollOffset,
				setDocsOpen: modal.setDocsOpen,
				setDocsView: modal.setDocsView,
				openAiSetup: modal.openAiSetup,
				openAiPrompt: modal.openAiPrompt,
				apiKey: ai.apiKey,
				handleGenerate,
				handleSaveResults,
				handleOpenModel,
				handleSaveModel,
				destroy: renderer.destroy,
			})
		)
			return;

		// Model tab – params panel shortcuts
		if (activeTab === 0 && modelTab.activePanel === "params") {
			handleModelTabParamKeys(key, {
				setActivePanel: modelTab.setActivePanel,
				handleDeleteParam: modelTab.handleDeleteParam,
				openClearConfirm: modal.openClearConfirm,
			});
			return;
		}

		// Model tab – submodels panel shortcuts
		if (activeTab === 0 && modelTab.activePanel === "submodels") {
			handleModelTabSubmodelKeys(key, {
				startAddSubmodel: modelTab.startAddSubmodel,
				handleDeleteSubmodel: modelTab.handleDeleteSubmodel,
			});
			return;
		}

		// Options tab: toggle fields with Enter
		if (activeTab === 1) {
			handleOptionsTabKeys(key, {
				activeOptionField,
				outputConfig,
				options,
				aiModel: ai.aiModel,
				aiModels: AI_MODELS,
				optionFields: OPTION_FIELDS,
				formatExtensions: FORMAT_EXTENSIONS,
				setActiveOptionField,
				setOutputConfig,
				setOptions,
				setAiModel: ai.setAiModel,
			});
		}
	});
}
