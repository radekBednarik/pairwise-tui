import { useRenderer } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiPromptOverlay } from "./components/AiPromptOverlay";
import { AiSetupOverlay } from "./components/AiSetupOverlay";
import { AnimatedLogo } from "./components/AnimatedLogo";
import { ClearConfirmOverlay } from "./components/ClearConfirmOverlay";
import { DocOverlay } from "./components/DocOverlay";
import { FilePickerOverlay } from "./components/FilePickerOverlay";
import { MessageLogOverlay } from "./components/MessageLogOverlay";
import { ModelTab } from "./components/ModelTab";
import { OptionsTab } from "./components/OptionsTab";
import { ResultsTab } from "./components/ResultsTab";
import { StatusBar } from "./components/StatusBar";
import { type ActiveOptionField, TAB_OPTIONS } from "./constants";
import { useAiState } from "./hooks/useAiState";
import { useAppKeyboard } from "./hooks/useAppKeyboard";
import { useModalState } from "./hooks/useModalState";
import { useModelTabState } from "./hooks/useModelTabState";
import { useStatusLog } from "./hooks/useStatusLog";
import { saveTestCases } from "./output/writer";
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
import { loadSettings, saveSettings } from "./settings/store";
import { ThemeContext } from "./theme/ThemeContext";
import { DEFAULT_THEME_NAME, THEMES, tokyonightDark } from "./theme/themes";
import type {
	ModelStorageConfig,
	OutputConfig,
	PictModel,
	PictOptions,
	TestCase,
} from "./types";

export function App() {
	const renderer = useRenderer();

	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const constraintsRef = useRef<any>(null);
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const aiPromptRef = useRef<any>(null);

	// --- Core state ---
	const [activeTab, setActiveTabState] = useState(0);
	const [model, setModel] = useState<PictModel>({
		parameters: [],
		submodels: [],
		constraints: "",
	});
	const [options, setOptions] = useState<PictOptions>({
		order: 2,
		randomize: false,
		caseSensitive: false,
	});
	const [outputConfig, setOutputConfig] = useState<OutputConfig>({
		filePath: "./output.txt",
		format: "txt",
	});
	const [modelStorage, setModelStorage] = useState<ModelStorageConfig>({
		storagePath: "./",
		fileTemplate: "model_{timestamp}",
	});
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
		setAiError,
		setAiIsLoading,
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
		});
	}, [options, outputConfig, modelStorage, themeName, aiModel]);

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
		} catch (err) {
			showStatus(
				err instanceof Error ? err.message : "Generation failed",
				true,
			);
		} finally {
			setIsGenerating(false);
		}
	}, [model, options, showStatus, setActiveTab]);

	const handleSaveResults = useCallback(async () => {
		if (results.length === 0) return;
		const headers = Object.keys(results[0] ?? {});
		try {
			await saveTestCases(headers, results, outputConfig);
			showStatus(
				`Saved ${results.length} test cases to ${outputConfig.filePath}`,
			);
		} catch (err) {
			showStatus(err instanceof Error ? err.message : "Save failed", true);
		}
	}, [results, outputConfig, showStatus]);

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
				showStatus(`No .txt files found in ${modelStorage.storagePath}`, true);
				return;
			}
			if (files.length === 1 && files[0]) {
				await loadModelFromPath(files[0].fp);
				return;
			}
			openPicker(files.map((f) => f.fp));
		} catch {
			showStatus(`Could not read directory ${modelStorage.storagePath}`, true);
		}
	}, [modelStorage, showStatus, loadModelFromPath, openPicker]);

	// --- AI actions ---
	const handleSaveApiKey = useCallback(() => {
		const key = aiKeyInput.trim();
		if (!key) return;
		void configureApiKey(key).then(() => {
			setApiKey(key);
			setAiKeyInput("");
			closeAiSetup();
			showStatus("AI configured");
		});
	}, [aiKeyInput, showStatus, setApiKey, setAiKeyInput, closeAiSetup]);

	const handleClearApiKey = useCallback(() => {
		void removeApiKey().then(() => {
			setApiKey(null);
			setAiKeyInput("");
			showStatus("API key cleared");
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
	});

	return (
		<ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
			<box
				flexDirection="column"
				width="100%"
				height="100%"
				paddingX={3}
				backgroundColor={theme.colors.bg.canvas}
			>
				{/* Header */}
				<box
					flexDirection="column"
					backgroundColor={theme.colors.bg.header}
					paddingX={2}
				>
					<box flexDirection="row" alignItems="center" gap={1} paddingY={1}>
						<AnimatedLogo />
						<ascii-font
							text="Pairwise TUI"
							font="tiny"
							color={theme.colors.accent}
						/>
					</box>
					<box flexDirection="row" gap={1}>
						{TAB_OPTIONS.map((tab, i) => (
							<box
								key={tab.name}
								backgroundColor={
									activeTab === i
										? theme.colors.bg.selected
										: theme.colors.bg.header
								}
								paddingX={1}
							>
								<text
									fg={
										activeTab === i
											? theme.colors.text.primary
											: theme.colors.text.disabled
									}
								>
									{`${i + 1}:${tab.name}`}
								</text>
							</box>
						))}
					</box>
				</box>

				{/* Content */}
				<box flexGrow={1} flexDirection="column">
					{logOpen ? (
						<MessageLogOverlay
							messages={logMessages}
							selectedIndex={logSelectedIndex}
							scrollOffset={logScrollOffset}
						/>
					) : docsOpen ? (
						<DocOverlay
							view={docsView}
							selectedChapterIdx={docsChapterIdx}
							scrollOffset={docsScrollOffset}
						/>
					) : pickerOpen ? (
						<FilePickerOverlay
							files={pickerFiles}
							selectedIndex={pickerIndex}
						/>
					) : aiSetupOpen ? (
						<AiSetupOverlay
							currentKey={apiKey}
							inputValue={aiKeyInput}
							onInputChange={setAiKeyInput}
							onSubmit={handleSaveApiKey}
						/>
					) : aiPromptOpen ? (
						<AiPromptOverlay
							textareaRef={aiPromptRef}
							textareaKey={aiPromptKey}
							isLoading={aiIsLoading}
							error={aiError}
							aiModel={aiModel}
						/>
					) : showClearConfirm ? (
						<ClearConfirmOverlay selectedIndex={clearConfirmIndex} />
					) : (
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
					)}
				</box>

				{/* Status message */}
				{status !== "" && (
					<box
						paddingX={2}
						backgroundColor={
							statusIsError
								? theme.colors.status.errorBg
								: theme.colors.status.successBg
						}
					>
						<text
							fg={
								statusIsError
									? theme.colors.status.error
									: theme.colors.status.success
							}
						>
							{status}
						</text>
					</box>
				)}

				{/* Status bar */}
				<StatusBar
					activeTab={activeTab}
					activePanel={
						logOpen
							? "log"
							: docsOpen
								? "docs"
								: pickerOpen
									? "picker"
									: aiSetupOpen
										? "aiSetup"
										: aiPromptOpen
											? "aiPrompt"
											: showClearConfirm
												? "clearConfirm"
												: activePanel
					}
					addingParam={activePanel === "adding"}
					hasResults={results.length > 0}
					activeOptionField={activeOptionField}
					hasAiKey={apiKey !== null}
				/>
			</box>
		</ThemeContext.Provider>
	);
}
