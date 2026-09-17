import { useRenderer } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiPromptOverlay } from "./components/AiPromptOverlay";
import { AiSetupOverlay } from "./components/AiSetupOverlay";
import { ClearConfirmOverlay } from "./components/ClearConfirmOverlay";
import { DocOverlay } from "./components/DocOverlay";
import { FilePickerOverlay } from "./components/FilePickerOverlay";
import { GenerateSaveOverlay } from "./components/GenerateSaveOverlay";
import { Header } from "./components/Header";
import { MessageLogOverlay } from "./components/MessageLogOverlay";
import { ModelTab } from "./components/ModelTab";
import { OptionsTab } from "./components/OptionsTab";
import { ResultsTab } from "./components/ResultsTab";
import { StatusBar } from "./components/StatusBar";
import { StatusMessage } from "./components/StatusMessage";
import type { ActiveOptionField } from "./constants";
import { formatFromExtension } from "./hooks/keyboard/optionsTabHandlers";
import { useAiState } from "./hooks/useAiState";
import { useAppKeyboard } from "./hooks/useAppKeyboard";
import { useModalState } from "./hooks/useModalState";
import { useModelTabState } from "./hooks/useModelTabState";
import { useStatusLog } from "./hooks/useStatusLog";
import { FORMAT_EXTENSIONS, saveTestCases } from "./output/writer";
import { runPict } from "./pict/runner";
import {
	configureApiKey,
	generateModelFromPrompt,
	removeApiKey,
} from "./services/aiService";
import {
	listModelFiles,
	loadModelFromFile,
	saveModelToFile,
} from "./services/modelFileService";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings/store";
import { ThemeContext } from "./theme/ThemeContext";
import { DEFAULT_THEME_NAME, THEMES, tokyonightDark } from "./theme/themes";
import type {
	ExportContext,
	ModelStorageConfig,
	OutputConfig,
	PictModel,
	PictOptions,
	TestCase,
} from "./types";
import { resolveActiveOverlay } from "./utils/overlay";

export function App() {
	const renderer = useRenderer();

	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const constraintsRef = useRef<any>(null);
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const aiPromptRef = useRef<any>(null);
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const generateSaveInputRef = useRef<any>(null);
	// The save dialog stays mounted while its async save runs, so its Enter
	// handler needs a re-entrancy guard against double submits.
	const generateSaveBusyRef = useRef(false);

	// Async flows (a PICT run, a directory listing) must not pop an overlay
	// beneath one the user opened in the meantime. They request the open here;
	// an effect below performs or drops it based on rendered overlay state, so
	// the check cannot race a queued state update.
	const [deferredOverlayOpen, setDeferredOverlayOpen] = useState<
		(() => void) | null
	>(null);
	const requestOverlayOpen = useCallback((open: () => void) => {
		setDeferredOverlayOpen(() => open);
	}, []);

	// --- Core state ---
	const [activeTab, setActiveTabState] = useState(0);
	const [model, setModel] = useState<PictModel>({
		parameters: [],
		submodels: [],
		constraints: "",
	});
	// Same defaults the config file falls back to, so a first run and a reset
	// config look alike. Copied, so state never aliases the shared defaults.
	const [options, setOptions] = useState<PictOptions>(() => ({
		...DEFAULT_SETTINGS.options,
	}));
	const [outputConfig, setOutputConfig] = useState<OutputConfig>(() => ({
		...DEFAULT_SETTINGS.outputConfig,
	}));
	const [modelStorage, setModelStorage] = useState<ModelStorageConfig>(() => ({
		...DEFAULT_SETTINGS.modelStorage,
	}));
	const [promptOnGenerate, setPromptOnGenerate] = useState(
		DEFAULT_SETTINGS.promptOnGenerate,
	);
	const [results, setResults] = useState<TestCase[]>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [themeName, setThemeName] = useState(DEFAULT_THEME_NAME);
	const theme = THEMES[themeName] ?? tokyonightDark;

	// --- Options tab state ---
	const [activeOptionField, setActiveOptionField] =
		useState<ActiveOptionField>("none");

	// --- Custom hooks ---
	const log = useStatusLog();
	const {
		status,
		statusIsError,
		logMessages,
		logOpen,
		logSelectedIndex,
		logScrollOffset,
		showStatus,
	} = log;

	const modal = useModalState();
	const {
		pickerOpen,
		pickerFiles,
		pickerIndex,
		openPicker,
		docsOpen,
		docsView,
		docsChapterIdx,
		docsScrollOffset,
		showClearConfirm,
		clearConfirmIndex,
		aiSetupOpen,
		aiPromptOpen,
		aiPromptKey,
		aiKeyInput,
		aiError,
		aiIsLoading,
		closeAiSetup,
		closeAiPrompt,
		setAiKeyInput,
		getAiKeyInput,
		setAiError,
		setAiIsLoading,
		generateSaveOpen,
		generateSavePath,
		generateSaveFormat,
		openGenerateSave,
		closeGenerateSave,
		setGenerateSavePath,
	} = modal;

	const ai = useAiState("claude-haiku-4-5");
	const { apiKey, aiModel, setApiKey, setAiModel } = ai;

	const modelTab = useModelTabState(model, setModel);
	const {
		activePanel,
		setActivePanel,
		selectedParamIndex,
		setSelectedParamIndex,
		valuesInput,
		setValuesInput,
		constraintsKey,
		setConstraintsKey,
		newParamName,
		selectedSubmodelIndex,
		submodelAddingStep,
		submodelParamsInput,
		submodelOrderInput,
		setSelectedSubmodelIndex,
		handleParamNavigate,
		handleValuesChange,
		handleNewParamNameChange,
		handleConfirmAddParam,
		handleSubmodelNavigate,
		handleSubmodelParamsInputChange,
		handleSubmodelOrderInputChange,
		handleConfirmSubmodelParams,
		handleConfirmSubmodelOrder,
		submodelDropdownFocused,
		submodelDropdownOptions,
		submodelValidationError,
		handleConstraintsChange,
		handleSubmodelDropdownSelect,
	} = modelTab;

	// --- Persistent settings ---
	const settingsLoadedRef = useRef(false);

	useEffect(() => {
		loadSettings().then((s) => {
			setOptions(s.options);
			setOutputConfig(s.outputConfig);
			setModelStorage(s.modelStorage);
			setThemeName(s.themeName);
			setAiModel(s.aiModel);
			setPromptOnGenerate(s.promptOnGenerate);
			settingsLoadedRef.current = true;
		});
	}, [setAiModel]);

	useEffect(() => {
		if (!settingsLoadedRef.current) return;
		void saveSettings({
			options,
			outputConfig,
			modelStorage,
			themeName,
			aiModel,
			promptOnGenerate,
		});
	}, [
		options,
		outputConfig,
		modelStorage,
		themeName,
		aiModel,
		promptOnGenerate,
	]);

	const setActiveTab = useCallback((tab: number) => {
		setActiveTabState(tab);
	}, []);

	// --- Actions ---
	const handleGenerate = useCallback(async () => {
		const currentConstraints =
			constraintsRef.current?.editBuffer?.getText() ?? model.constraints;
		const modelToRun = { ...model, constraints: currentConstraints };

		if (modelToRun.parameters.length === 0) {
			showStatus("Add at least one parameter first", true);
			return;
		}
		const hasEmptyValues = modelToRun.parameters.some(
			(p) => p.values.length === 0,
		);
		if (hasEmptyValues) {
			showStatus("All parameters must have at least one value", true);
			return;
		}
		setIsGenerating(true);
		showStatus("Generating...");
		try {
			const testCases = await runPict(modelToRun, options);
			setResults(testCases);
			setActiveTab(2);
			showStatus(`Generated ${testCases.length} test cases`);
			// Requested, not opened directly: dropped if another overlay is on top
			// (say, the message log opened during the run) - the dialog would open
			// invisibly beneath it and spring up when that overlay closes. [s]
			// still saves on demand.
			if (promptOnGenerate && testCases.length > 0) {
				requestOverlayOpen(() => openGenerateSave(outputConfig));
			}
		} catch (err) {
			showStatus(
				err instanceof Error ? err.message : "Generation failed",
				true,
			);
		} finally {
			setIsGenerating(false);
		}
	}, [
		model,
		options,
		showStatus,
		setActiveTab,
		promptOnGenerate,
		openGenerateSave,
		outputConfig,
		requestOverlayOpen,
	]);

	// Shared by the [s] shortcut and the save-on-generate dialog; returns
	// whether the file was actually written.
	const saveResultsWith = useCallback(
		async (cfg: OutputConfig): Promise<boolean> => {
			if (results.length === 0) {
				showStatus("No test cases to save - generate first", true);
				return false;
			}
			const headers = Object.keys(results[0] ?? {});
			const context: ExportContext = {
				headers,
				rows: results,
				config: cfg,
				model,
				options,
			};
			try {
				const path = await saveTestCases(context);
				showStatus(`Saved ${results.length} test cases to ${path}`);
				return true;
			} catch (err) {
				showStatus(err instanceof Error ? err.message : "Save failed", true);
				return false;
			}
		},
		[results, model, options, showStatus],
	);

	const handleSaveResults = useCallback(async () => {
		await saveResultsWith(outputConfig);
	}, [saveResultsWith, outputConfig]);

	const handleGenerateSaveConfirm = useCallback(async () => {
		if (generateSaveBusyRef.current) return;
		// The <input> emits change only on blur/submit, so read the live text
		// from the renderable itself (see CLAUDE.md).
		const filePath = (
			generateSaveInputRef.current?.value ?? generateSavePath
		).trim();
		if (filePath === "") {
			showStatus("Output path cannot be empty", true);
			return;
		}
		// A typed extension wins over the format selector, so the written
		// content always matches the file name.
		const format =
			formatFromExtension(filePath, FORMAT_EXTENSIONS) ?? generateSaveFormat;
		const cfg: OutputConfig = { filePath, format };
		generateSaveBusyRef.current = true;
		try {
			// Close and write back only after a save that actually produced a
			// file: a failure keeps the dialog (and the typed path) on screen for
			// correction, and cannot replace a working default.
			if (await saveResultsWith(cfg)) {
				setOutputConfig(cfg);
				closeGenerateSave();
			}
		} finally {
			generateSaveBusyRef.current = false;
		}
	}, [
		generateSavePath,
		generateSaveFormat,
		closeGenerateSave,
		saveResultsWith,
		showStatus,
	]);

	const handleSaveModel = useCallback(async () => {
		const currentConstraints =
			constraintsRef.current?.editBuffer?.getText() ?? model.constraints;
		try {
			const path = await saveModelToFile(
				model,
				currentConstraints,
				modelStorage,
			);
			showStatus(`Model saved to ${path}`);
		} catch (err) {
			showStatus(err instanceof Error ? err.message : "Save failed", true);
		}
	}, [model, modelStorage, showStatus]);

	const loadModelFromPath = useCallback(
		async (path: string) => {
			try {
				const loaded = await loadModelFromFile(path);
				setModel(loaded);
				setSelectedParamIndex(0);
				setSelectedSubmodelIndex(0);
				setValuesInput(loaded.parameters[0]?.values.join(", ") ?? "");
				setConstraintsKey((k) => k + 1);
				setActiveTab(0);
				setActivePanel("params");
				showStatus(
					`Loaded model from ${path} (${loaded.parameters.length} parameters)`,
				);
			} catch {
				showStatus(`Could not read ${path}`, true);
			}
		},
		[
			showStatus,
			setActiveTab,
			setSelectedParamIndex,
			setSelectedSubmodelIndex,
			setValuesInput,
			setConstraintsKey,
			setActivePanel,
		],
	);

	const handleOpenModel = useCallback(async () => {
		try {
			const files = await listModelFiles(modelStorage.storagePath);
			if (files.length === 0) {
				showStatus(
					`No .pictm files found in ${modelStorage.storagePath}`,
					true,
				);
				return;
			}
			if (files.length === 1 && files[0]) {
				await loadModelFromPath(files[0].fp);
				return;
			}
			// Via the deferred open: the listing is async, so an overlay opened in
			// the meantime must win over the picker.
			requestOverlayOpen(() => openPicker(files.map((f) => f.fp)));
		} catch {
			showStatus(`Could not read directory ${modelStorage.storagePath}`, true);
		}
	}, [
		modelStorage,
		showStatus,
		loadModelFromPath,
		openPicker,
		requestOverlayOpen,
	]);

	// --- AI actions ---
	const handleSaveApiKey = useCallback(() => {
		const key = getAiKeyInput().trim();
		if (!key) return;
		void configureApiKey(key).then(() => {
			setApiKey(key);
			setAiKeyInput("");
			closeAiSetup();
			showStatus("AI configured");
		});
	}, [getAiKeyInput, showStatus, setApiKey, setAiKeyInput, closeAiSetup]);

	const handleClearApiKey = useCallback(() => {
		void removeApiKey()
			.then(() => {
				setApiKey(null);
				setAiKeyInput("");
				showStatus("API key cleared");
			})
			.catch((err) => {
				// The key is still on disk — say so rather than reporting success.
				showStatus(
					`Could not clear API key: ${err instanceof Error ? err.message : String(err)}`,
					true,
				);
			});
	}, [showStatus, setApiKey, setAiKeyInput]);

	const handleAiGenerate = useCallback(() => {
		const prompt = aiPromptRef.current?.editBuffer?.getText()?.trim() ?? "";
		if (!apiKey || !prompt || aiIsLoading) return;
		setAiIsLoading(true);
		setAiError("");
		void generateModelFromPrompt(prompt, apiKey, aiModel)
			.then(({ parameters, submodels, constraints }) => {
				setModel((m) => ({ ...m, parameters, submodels, constraints }));
				setSelectedSubmodelIndex(0);
				setConstraintsKey((k) => k + 1);
				closeAiPrompt();
				setAiIsLoading(false);
				setActiveTab(0);
				const constraintNote = constraints ? " and constraints" : "";
				const submodelNote =
					submodels.length > 0 ? `, ${submodels.length} sub-model(s)` : "";
				showStatus(
					`AI generated ${parameters.length} parameters${submodelNote}${constraintNote} — verify and press [g]`,
				);
			})
			.catch((err) => {
				setAiIsLoading(false);
				setAiError(err instanceof Error ? err.message : "Unknown error");
			});
	}, [
		apiKey,
		aiModel,
		aiIsLoading,
		showStatus,
		setActiveTab,
		setSelectedSubmodelIndex,
		setConstraintsKey,
		closeAiPrompt,
		setAiIsLoading,
		setAiError,
	]);

	// --- Clear model action (passed to keyboard handler) ---
	const clearModel = useCallback(() => {
		setModel({ parameters: [], submodels: [], constraints: "" });
		setSelectedParamIndex(0);
		setSelectedSubmodelIndex(0);
		setValuesInput("");
		setActivePanel("params");
		setConstraintsKey((k) => k + 1);
		showStatus("Model cleared");
	}, [
		showStatus,
		setSelectedParamIndex,
		setSelectedSubmodelIndex,
		setValuesInput,
		setActivePanel,
		setConstraintsKey,
	]);

	// --- Keyboard handler ---
	useAppKeyboard({
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
		modelStorage,
		results,
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
		getGenerateSavePath: () =>
			generateSaveInputRef.current?.value ?? generateSavePath,
		isGenerateSaveBusy: () => generateSaveBusyRef.current,
		promptOnGenerate,
		setPromptOnGenerate,
	});

	// Resolved once so the overlay switch below and the status bar's active
	// panel can never disagree about which overlay (if any) is on top.
	const overlayKind = resolveActiveOverlay({
		logOpen,
		docsOpen,
		pickerOpen,
		aiSetupOpen,
		aiPromptOpen,
		showClearConfirm,
		generateSaveOpen,
	});

	// Perform or drop a requested overlay open (see requestOverlayOpen above):
	// by effect time both the request and any competing overlay state have
	// rendered, so this decides on what is actually on screen.
	useEffect(() => {
		if (deferredOverlayOpen === null) return;
		if (overlayKind === null) deferredOverlayOpen();
		setDeferredOverlayOpen(null);
	}, [deferredOverlayOpen, overlayKind]);

	const renderOverlay = () => {
		switch (overlayKind) {
			case "log":
				return (
					<MessageLogOverlay
						messages={logMessages}
						selectedIndex={logSelectedIndex}
						scrollOffset={logScrollOffset}
					/>
				);
			case "docs":
				return (
					<DocOverlay
						view={docsView}
						selectedChapterIdx={docsChapterIdx}
						scrollOffset={docsScrollOffset}
					/>
				);
			case "picker":
				return (
					<FilePickerOverlay files={pickerFiles} selectedIndex={pickerIndex} />
				);
			case "aiSetup":
				return (
					<AiSetupOverlay
						currentKey={apiKey}
						inputValue={aiKeyInput}
						onInputChange={setAiKeyInput}
						onSubmit={handleSaveApiKey}
					/>
				);
			case "aiPrompt":
				return (
					<AiPromptOverlay
						textareaRef={aiPromptRef}
						textareaKey={aiPromptKey}
						isLoading={aiIsLoading}
						error={aiError}
						aiModel={aiModel}
					/>
				);
			case "clearConfirm":
				return <ClearConfirmOverlay selectedIndex={clearConfirmIndex} />;
			case "generateSave":
				return (
					<GenerateSaveOverlay
						inputRef={generateSaveInputRef}
						path={generateSavePath}
						format={generateSaveFormat}
						onPathChange={setGenerateSavePath}
						onSubmit={handleGenerateSaveConfirm}
					/>
				);
		}
	};

	const renderTabs = () => (
		<>
			{activeTab === 0 && (
				<ModelTab
					model={model}
					activePanel={activePanel}
					selectedParamIndex={selectedParamIndex}
					newParamName={newParamName}
					valuesInput={valuesInput}
					constraintsKey={constraintsKey}
					constraintsRef={constraintsRef}
					selectedSubmodelIndex={selectedSubmodelIndex}
					submodelAddingStep={submodelAddingStep}
					submodelParamsInput={submodelParamsInput}
					submodelOrderInput={submodelOrderInput}
					onParamNavigate={handleParamNavigate}
					onValuesChange={handleValuesChange}
					onNewParamNameChange={handleNewParamNameChange}
					onConfirmAddParam={handleConfirmAddParam}
					onSubmodelNavigate={handleSubmodelNavigate}
					onSubmodelParamsChange={handleSubmodelParamsInputChange}
					onSubmodelOrderChange={handleSubmodelOrderInputChange}
					onConfirmSubmodelParams={handleConfirmSubmodelParams}
					onConfirmSubmodelOrder={handleConfirmSubmodelOrder}
					submodelDropdownFocused={submodelDropdownFocused}
					submodelDropdownOptions={submodelDropdownOptions}
					submodelValidationError={submodelValidationError}
					onConstraintsChange={handleConstraintsChange}
					onSubmodelDropdownSelect={handleSubmodelDropdownSelect}
				/>
			)}
			{activeTab === 1 && (
				<OptionsTab
					options={options}
					outputConfig={outputConfig}
					modelStorage={modelStorage}
					aiModel={aiModel}
					promptOnGenerate={promptOnGenerate}
					activeField={activeOptionField}
					onOutputConfigChange={setOutputConfig}
					onOptionsChange={setOptions}
					onModelStorageChange={setModelStorage}
				/>
			)}
			{activeTab === 2 && (
				<ResultsTab results={results} focused={activeTab === 2} />
			)}
		</>
	);

	return (
		<ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
			<box
				flexDirection="column"
				width="100%"
				height="100%"
				paddingX={3}
				backgroundColor={theme.colors.bg.canvas}
			>
				<Header activeTab={activeTab} />

				{/* Content */}
				<box flexGrow={1} flexDirection="column">
					{overlayKind ? renderOverlay() : renderTabs()}
				</box>

				<StatusMessage status={status} statusIsError={statusIsError} />

				{/* Status bar */}
				<StatusBar
					activeTab={activeTab}
					activePanel={overlayKind ?? activePanel}
					addingParam={activePanel === "adding"}
					hasResults={results.length > 0}
					activeOptionField={activeOptionField}
					hasAiKey={apiKey !== null}
				/>
			</box>
		</ThemeContext.Provider>
	);
}
