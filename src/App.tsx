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
import { useAiState } from "./hooks/useAiState";
import { useAppKeyboard } from "./hooks/useAppKeyboard";
import { useDeferredScreenChange } from "./hooks/useDeferredScreenChange";
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
import { formatFromExtension } from "./utils/outputPath";
import { resolveActiveOverlay } from "./utils/overlay";
import { isTextInputActive, TEXT_INPUT_OPTION_FIELDS } from "./utils/textInput";

// `runPict` is injectable so tests can hold a run open deterministically.
export function App({
	runPict: run = runPict,
}: {
	runPict?: typeof runPict;
} = {}) {
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
		stopEditing,
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

	// Resolved once so the overlay switch, the status bar's active panel and
	// the deferred opens below can never disagree about which overlay (if any)
	// is on top.
	const overlayKind = resolveActiveOverlay({
		logOpen,
		docsOpen,
		pickerOpen,
		aiSetupOpen,
		aiPromptOpen,
		showClearConfirm,
		generateSaveOpen,
	});

	// Async flows (a PICT run, a directory listing) must not change the screen
	// beneath an overlay the user opened in the meantime, nor while a text
	// field is being typed into: a tab switch or overlay would unmount the
	// input and discard the text. They request the change; the hook applies or
	// drops it once the competing state has rendered, so the check cannot race
	// a queued state update.
	const textInputActive = isTextInputActive(
		activeTab,
		activePanel,
		activeOptionField,
	);
	const requestScreenChange = useDeferredScreenChange(
		overlayKind === null && !textInputActive,
	);

	// Latest values for the deferred generation completion: its closures are
	// made when [g] is pressed, but must act on the settings and editing state
	// as they are when the run finishes.
	const latestRef = useRef({ outputConfig, promptOnGenerate, textInputActive });
	latestRef.current = { outputConfig, promptOnGenerate, textInputActive };

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

	// Leaving a tab ends any text edit on it: a programmatic switch (a finished
	// generation jumping to Results) must not strand the keyboard router in an
	// editing mode whose input is no longer on screen.
	const setActiveTab = useCallback(
		(tab: number) => {
			if (tab !== 0) stopEditing();
			if (tab !== 1) {
				// Only a text field can strand the router; a highlighted toggle or
				// selector keeps its place for the round trip.
				setActiveOptionField((field) =>
					TEXT_INPUT_OPTION_FIELDS.has(field) ? "none" : field,
				);
			}
			setActiveTabState(tab);
		},
		[stopEditing],
	);

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
			const testCases = await run(modelToRun, options);
			setResults(testCases);
			const count = testCases.length;
			// Deferred, not applied directly: a run that finishes behind an overlay
			// (say, the message log opened meanwhile) or while a text field is being
			// edited must neither yank the user to the Results tab nor pop the save
			// dialog over their input. The drop is reported instead; the results
			// wait on the Results tab and [s] saves on demand.
			requestScreenChange(
				() => {
					const latest = latestRef.current;
					setActiveTab(2);
					showStatus(`Generated ${count} test cases`);
					if (latest.promptOnGenerate && count > 0) {
						openGenerateSave(latest.outputConfig);
					}
				},
				() => {
					// While a text field is focused its input swallows the shortcuts,
					// so the hint must start with leaving it.
					const latest = latestRef.current;
					const save =
						latest.promptOnGenerate && count > 0 ? " or [s] to save" : "";
					showStatus(
						latest.textInputActive
							? `Generated ${count} test cases - press Esc, then [3] for results${save}`
							: `Generated ${count} test cases - see the Results tab [3]${save}`,
					);
				},
			);
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
		openGenerateSave,
		run,
		requestScreenChange,
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
			// Both branches go through the deferred screen change: the listing is
			// async, so an overlay opened or a text field focused in the meantime
			// must win over the load or the picker.
			const only = files.length === 1 ? files[0] : undefined;
			if (only) {
				requestScreenChange(
					() => void loadModelFromPath(only.fp),
					() => showStatus("Model load skipped - press [o] again"),
				);
				return;
			}
			requestScreenChange(
				() => openPicker(files.map((f) => f.fp)),
				() => showStatus("Model picker skipped - press [o] again"),
			);
		} catch {
			showStatus(`Could not read directory ${modelStorage.storagePath}`, true);
		}
	}, [
		modelStorage,
		showStatus,
		loadModelFromPath,
		openPicker,
		requestScreenChange,
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
		overlayKind,
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
