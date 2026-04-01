import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateModel } from "./ai/client";
import { clearApiKey, loadApiKey, saveApiKey } from "./ai/credentials";
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
import { DOC_CHAPTERS } from "./docs/pict-docs";
import { FORMAT_EXTENSIONS, saveTestCases } from "./output/writer";
import { buildModelFile, parseModelFile } from "./pict/model";
import { runPict } from "./pict/runner";
import { loadSettings, saveSettings } from "./settings/store";
import { ThemeContext } from "./theme/ThemeContext";
import {
	DEFAULT_THEME_NAME,
	THEME_NAMES,
	THEMES,
	tokyonightDark,
} from "./theme/themes";
import type {
	AiModel,
	LogMessage,
	ModelStorageConfig,
	OutputConfig,
	OutputFormat,
	PictModel,
	PictOptions,
	TestCase,
} from "./types";
import { copyToClipboard } from "./utils/clipboard";

let nextLogId = 0;

function formatLogEntry(msg: LogMessage): string {
	const ts = msg.timestamp.toLocaleTimeString();
	return `${ts} [${msg.type === "error" ? "ERR" : "INF"}] ${msg.text}`;
}

const TAB_OPTIONS = [
	{ name: "Model", description: "Define parameters and constraints" },
	{ name: "Options", description: "Configure PICT and output" },
	{ name: "Results", description: "View generated test cases" },
];

type ActivePanel = "params" | "values" | "constraints" | "adding";
type ActiveOptionField =
	| "filepath"
	| "format"
	| "order"
	| "randomize"
	| "caseSensitive"
	| "storagePath"
	| "fileTemplate"
	| "aiModel"
	| "none";

const OPTION_FIELDS: ActiveOptionField[] = [
	"filepath",
	"format",
	"order",
	"randomize",
	"caseSensitive",
	"storagePath",
	"fileTemplate",
	"aiModel",
	"none",
];

const AI_MODELS: AiModel[] = [
	"claude-haiku-4-5",
	"claude-sonnet-4-6",
	"claude-opus-4-6",
];

export function App() {
	const renderer = useRenderer();

	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const constraintsRef = useRef<any>(null);
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	const aiPromptRef = useRef<any>(null);

	// --- Main state ---
	const [activeTab, setActiveTabState] = useState(0);
	const [model, setModel] = useState<PictModel>({
		parameters: [],
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
	const [pickerFiles, setPickerFiles] = useState<string[]>([]);
	const [pickerIndex, setPickerIndex] = useState(0);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [docsOpen, setDocsOpen] = useState(false);
	const [docsView, setDocsView] = useState<"list" | "chapter">("list");
	const [docsChapterIdx, setDocsChapterIdx] = useState(0);
	const [docsScrollOffset, setDocsScrollOffset] = useState(0);
	const [results, setResults] = useState<TestCase[]>([]);
	const [status, setStatus] = useState("");
	const [statusIsError, setStatusIsError] = useState(false);
	const [logMessages, setLogMessages] = useState<LogMessage[]>([]);
	const [logOpen, setLogOpen] = useState(false);
	const [logSelectedIndex, setLogSelectedIndex] = useState(0);
	const [logScrollOffset, setLogScrollOffset] = useState(0);
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [clearConfirmIndex, setClearConfirmIndex] = useState(1);
	const [isGenerating, setIsGenerating] = useState(false);
	const [themeName, setThemeName] = useState(DEFAULT_THEME_NAME);
	const [aiModel, setAiModel] = useState<AiModel>("claude-haiku-4-5");

	// --- AI state ---
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [aiSetupOpen, setAiSetupOpen] = useState(false);
	const [aiPromptOpen, setAiPromptOpen] = useState(false);
	const [aiKeyInput, setAiKeyInput] = useState("");
	const [aiPromptKey, setAiPromptKey] = useState(0);
	const [aiIsLoading, setAiIsLoading] = useState(false);
	const [aiError, setAiError] = useState("");
	const theme = THEMES[themeName] ?? tokyonightDark;

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
		loadApiKey().then(setApiKey);
	}, []);

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

	// --- Model tab state ---
	const [activePanel, setActivePanel] = useState<ActivePanel>("params");
	const [selectedParamIndex, setSelectedParamIndex] = useState(0);
	const [newParamName, setNewParamName] = useState("");
	const newParamNameRef = useRef("");
	const [valuesInput, setValuesInput] = useState("");
	const [constraintsKey, setConstraintsKey] = useState(0);

	// --- Options tab state ---
	const [activeOptionField, setActiveOptionField] =
		useState<ActiveOptionField>("none");

	const setActiveTab = useCallback((tab: number) => {
		setActiveTabState(tab);
	}, []);

	// Sync valuesInput when selected param changes (intentionally omits model.parameters
	// to avoid overwriting the user's input on every keystroke)
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional omission
	useEffect(() => {
		const param = model.parameters[selectedParamIndex];
		setValuesInput(param ? param.values.join(", ") : "");
	}, [selectedParamIndex]);

	const showStatus = useCallback((msg: string, isError = false) => {
		setStatus(msg);
		setStatusIsError(isError);
		setLogMessages((prev) => [
			...prev,
			{
				id: nextLogId++,
				timestamp: new Date(),
				type: isError ? "error" : "info",
				text: msg,
			},
		]);
		setTimeout(() => setStatus(""), 4000);
	}, []);

	// --- Actions ---
	const handleParamNavigate = useCallback((index: number) => {
		setSelectedParamIndex(index);
	}, []);

	const handleValuesChange = useCallback(
		(value: string) => {
			setValuesInput(value);
			const parts = value
				.split(",")
				.map((v) => v.trim())
				.filter((v) => v.length > 0);
			setModel((m) => ({
				...m,
				parameters: m.parameters.map((p, i) =>
					i === selectedParamIndex ? { ...p, values: parts } : p,
				),
			}));
		},
		[selectedParamIndex],
	);

	const handleNewParamNameChange = useCallback((name: string) => {
		newParamNameRef.current = name;
		setNewParamName(name);
	}, []);

	const handleConfirmAddParam = useCallback(() => {
		const name = newParamNameRef.current.trim();
		if (!name) return;
		newParamNameRef.current = "";
		setModel((m) => {
			const newParams = [...m.parameters, { name, values: [] }];
			setSelectedParamIndex(newParams.length - 1);
			setValuesInput("");
			return { ...m, parameters: newParams };
		});
		setNewParamName("");
		setActivePanel("params");
	}, []);

	const handleDeleteParam = useCallback(() => {
		setModel((m) => {
			if (m.parameters.length === 0) return m;
			return {
				...m,
				parameters: m.parameters.filter((_, i) => i !== selectedParamIndex),
			};
		});
		setSelectedParamIndex((i) => Math.max(0, i - 1));
	}, [selectedParamIndex]);

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
		const modelToSave = { ...model, constraints: currentConstraints };
		const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
		const filename = `${modelStorage.fileTemplate.replace("{timestamp}", ts)}.txt`;
		const path = join(resolve(modelStorage.storagePath), filename);
		try {
			await Bun.write(path, buildModelFile(modelToSave));
			showStatus(`Model saved to ${path}`);
		} catch (err) {
			showStatus(err instanceof Error ? err.message : "Save failed", true);
		}
	}, [model, modelStorage, showStatus]);

	const loadModelFromPath = useCallback(
		async (path: string) => {
			try {
				const content = await Bun.file(path).text();
				const loaded = parseModelFile(content);
				setModel(loaded);
				setSelectedParamIndex(0);
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
		[showStatus, setActiveTab],
	);

	const handleOpenModel = useCallback(async () => {
		const dir = resolve(modelStorage.storagePath);
		try {
			const entries = await readdir(dir);
			const txtFiles = entries.filter((e) => e.endsWith(".txt"));
			if (txtFiles.length === 0) {
				showStatus(`No .txt files found in ${dir}`, true);
				return;
			}
			if (txtFiles.length === 1) {
				const only = txtFiles[0];
				if (only) await loadModelFromPath(join(dir, only));
				return;
			}
			const withMtime = await Promise.all(
				txtFiles.map(async (name) => {
					const fp = join(dir, name);
					return { fp, mtime: (await stat(fp)).mtimeMs };
				}),
			);
			withMtime.sort((a, b) => b.mtime - a.mtime);
			setPickerFiles(withMtime.map((f) => f.fp));
			setPickerIndex(0);
			setPickerOpen(true);
		} catch {
			showStatus(`Could not read directory ${dir}`, true);
		}
	}, [modelStorage, showStatus, loadModelFromPath]);

	// --- AI actions ---
	const handleSaveApiKey = useCallback(() => {
		const key = aiKeyInput.trim();
		if (!key) return;
		void saveApiKey(key).then(() => {
			setApiKey(key);
			setAiKeyInput("");
			setAiSetupOpen(false);
			showStatus("AI configured");
		});
	}, [aiKeyInput, showStatus]);

	const handleClearApiKey = useCallback(() => {
		void clearApiKey().then(() => {
			setApiKey(null);
			setAiKeyInput("");
			showStatus("API key cleared");
		});
	}, [showStatus]);

	const handleAiGenerate = useCallback(() => {
		const prompt = aiPromptRef.current?.editBuffer?.getText()?.trim() ?? "";
		if (!apiKey || !prompt || aiIsLoading) return;
		setAiIsLoading(true);
		setAiError("");
		void generateModel(prompt, apiKey, aiModel)
			.then(({ parameters, constraints }) => {
				setModel((m) => ({ ...m, parameters, constraints }));
				setConstraintsKey((k) => k + 1);
				setAiPromptOpen(false);
				setAiIsLoading(false);
				setActiveTab(0);
				const constraintNote = constraints ? " and constraints" : "";
				showStatus(
					`AI generated ${parameters.length} parameters${constraintNote} — verify and press [g]`,
				);
			})
			.catch((err) => {
				setAiIsLoading(false);
				setAiError(err instanceof Error ? err.message : "Unknown error");
			});
	}, [apiKey, aiModel, aiIsLoading, showStatus, setActiveTab]);

	// --- Keyboard handler ---
	useKeyboard((key) => {
		const { name, ctrl } = key;

		// Always: quit via Ctrl+C
		if (ctrl && name === "c") {
			renderer.destroy();
			return;
		}

		// F2: open AI setup from anywhere (safe in text inputs — not a character)
		if (name === "f2" && !aiSetupOpen) {
			setAiPromptOpen(false);
			setAiError("");
			setAiKeyInput("");
			setAiSetupOpen(true);
			return;
		}

		// File picker intercept
		if (pickerOpen) {
			if (name === "escape") {
				setPickerOpen(false);
				setPickerFiles([]);
				return;
			}
			if (name === "up") {
				setPickerIndex((i) => Math.max(0, i - 1));
				return;
			}
			if (name === "down") {
				setPickerIndex((i) => Math.min(pickerFiles.length - 1, i + 1));
				return;
			}
			if (name === "return") {
				const chosen = pickerFiles[pickerIndex];
				if (chosen) {
					setPickerOpen(false);
					setPickerFiles([]);
					void loadModelFromPath(chosen);
				}
				return;
			}
			return;
		}

		// Docs overlay intercept
		if (docsOpen) {
			if (docsView === "list") {
				if (name === "escape") {
					setDocsOpen(false);
					setDocsView("list");
					return;
				}
				if (name === "up") {
					setDocsChapterIdx((i) => Math.max(0, i - 1));
					return;
				}
				if (name === "down") {
					setDocsChapterIdx((i) => Math.min(DOC_CHAPTERS.length - 1, i + 1));
					return;
				}
				if (name === "return") {
					setDocsScrollOffset(0);
					setDocsView("chapter");
					return;
				}
			} else {
				if (name === "escape") {
					setDocsView("list");
					return;
				}
				if (name === "up") {
					setDocsScrollOffset((o) => Math.max(0, o - 1));
					return;
				}
				if (name === "down") {
					setDocsScrollOffset((o) => o + 1);
					return;
				}
			}
			return; // swallow all other keys while docs open
		}

		// Message log overlay intercept
		if (logOpen) {
			if (name === "escape" || name === "m") {
				setLogOpen(false);
				return;
			}
			if (name === "up") {
				setLogSelectedIndex((i) => Math.max(0, i - 1));
				setLogScrollOffset((o) => Math.max(0, o - 1));
				return;
			}
			if (name === "down") {
				setLogSelectedIndex((i) => Math.min(logMessages.length - 1, i + 1));
				setLogScrollOffset((o) => o + 1);
				return;
			}
			if (name === "c") {
				const msg = logMessages[logSelectedIndex];
				if (msg) {
					const ok = copyToClipboard(formatLogEntry(msg), renderer);
					showStatus(
						ok
							? "Copied to clipboard"
							: "Copy failed — install wl-clipboard or xclip",
						!ok,
					);
				}
				return;
			}
			if (name === "a") {
				const ok = copyToClipboard(
					logMessages.map(formatLogEntry).join("\n"),
					renderer,
				);
				showStatus(
					ok
						? "Copied all entries to clipboard"
						: "Copy failed — install wl-clipboard or xclip",
					!ok,
				);
				return;
			}
			return; // swallow all other keys
		}

		// Clear confirm overlay intercept
		if (showClearConfirm) {
			if (name === "escape" || (name === "return" && clearConfirmIndex === 1)) {
				setShowClearConfirm(false);
				setClearConfirmIndex(1);
				return;
			}
			if (name === "up" || name === "down") {
				setClearConfirmIndex((i) => (i === 0 ? 1 : 0));
				return;
			}
			if (name === "return" && clearConfirmIndex === 0) {
				setModel({ parameters: [], constraints: "" });
				setSelectedParamIndex(0);
				setValuesInput("");
				setActivePanel("params");
				setConstraintsKey((k) => k + 1);
				setShowClearConfirm(false);
				setClearConfirmIndex(1);
				showStatus("Model cleared");
				return;
			}
			return; // swallow all other keys
		}

		// AI setup overlay intercept
		if (aiSetupOpen) {
			if (name === "escape") {
				setAiSetupOpen(false);
				setAiKeyInput("");
				return;
			}
			if (name === "d") {
				handleClearApiKey();
				return;
			}
			return; // <input> handles typing; Enter via onSubmit
		}

		// AI prompt overlay intercept
		if (aiPromptOpen) {
			if (name === "escape") {
				if (!aiIsLoading) {
					setAiPromptOpen(false);
					setAiError("");
				}
				return;
			}
			if (ctrl && name === "g" && !aiIsLoading) {
				handleAiGenerate();
				return;
			}
			return; // textarea handles all other keys (Enter = newline)
		}

		// Escape: exit current input mode
		if (name === "escape") {
			if (activePanel === "adding") {
				setActivePanel("params");
				setNewParamName("");
				return;
			}
			if (
				activeTab === 0 &&
				(activePanel === "values" || activePanel === "constraints")
			) {
				setActivePanel("params");
				return;
			}
			if (activeTab === 1 && activeOptionField !== "none") {
				setActiveOptionField("none");
				return;
			}
			return;
		}

		// Adding param: all keys handled by <input> (Enter via onSubmit)
		if (activePanel === "adding") {
			return;
		}

		// Values panel: Escape handled above; all other keys go to <input>
		if (activeTab === 0 && activePanel === "values") {
			return;
		}

		// Constraints panel: Escape handled above; all other keys go to <textarea>
		if (activeTab === 0 && activePanel === "constraints") {
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
				return;
			}
			return;
		}

		// --- Not in text editing mode from here ---

		// Tab key for panel/field cycling
		if (name === "tab") {
			if (activeTab === 0 && activePanel === "params") {
				setActivePanel("values");
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

		// Switch tabs with number keys or [ ]
		if (name === "1") {
			setActiveTab(0);
			return;
		}
		if (name === "2") {
			setActiveTab(1);
			return;
		}
		if (name === "3") {
			setActiveTab(2);
			return;
		}
		if (name === "[") {
			setActiveTab((activeTab - 1 + 3) % 3);
			return;
		}
		if (name === "]") {
			setActiveTab((activeTab + 1) % 3);
			return;
		}

		// Global actions
		if (name === "m") {
			setLogOpen(true);
			setLogSelectedIndex(Math.max(0, logMessages.length - 1));
			setLogScrollOffset(Math.max(0, logMessages.length - 1));
			return;
		}
		if (name === "?") {
			setDocsOpen(true);
			setDocsView("list");
			return;
		}
		if (name === "q") {
			renderer.destroy();
			return;
		}
		if (name === "g" && !isGenerating) {
			void handleGenerate();
			return;
		}
		if (name === "s") {
			void handleSaveResults();
			return;
		}
		if (name === "o") {
			void handleOpenModel();
			return;
		}
		if (name === "w") {
			void handleSaveModel();
			return;
		}
		if (name === "t") {
			const idx = THEME_NAMES.indexOf(themeName);
			const newThemeName =
				THEME_NAMES[(idx + 1) % THEME_NAMES.length] ?? DEFAULT_THEME_NAME;
			setThemeName(newThemeName);
			showStatus(`Theme: ${newThemeName}`);
			return;
		}
		if (name === "i") {
			if (apiKey) {
				setAiPromptKey((k) => k + 1);
				setAiError("");
				setAiPromptOpen(true);
			} else {
				setAiKeyInput("");
				setAiSetupOpen(true);
			}
			return;
		}

		// Model tab – params panel shortcuts
		if (activeTab === 0 && activePanel === "params") {
			if (name === "a") {
				setActivePanel("adding");
				setNewParamName("");
				return;
			}
			if (name === "d") {
				handleDeleteParam();
				return;
			}
			if (name === "e") {
				setActivePanel("values");
				return;
			}
			if (name === "c") {
				setActivePanel("constraints");
				return;
			}
			if (name === "x") {
				setClearConfirmIndex(1);
				setShowClearConfirm(true);
				return;
			}
			return;
		}

		// Options tab: toggle fields with Enter
		if (activeTab === 1) {
			if (name === "return") {
				if (activeOptionField === "format") {
					const formats: OutputFormat[] = ["txt", "json", "csv", "xlsx"];
					const next =
						formats[
							(formats.indexOf(outputConfig.format) + 1) % formats.length
						] ?? "txt";
					const base = outputConfig.filePath.replace(/\.[^.]+$/, "");
					setOutputConfig({
						format: next,
						filePath: `${base}${FORMAT_EXTENSIONS[next]}`,
					});
					return;
				}
				if (activeOptionField === "randomize") {
					setOptions((o) => ({ ...o, randomize: !o.randomize }));
					return;
				}
				if (activeOptionField === "caseSensitive") {
					setOptions((o) => ({ ...o, caseSensitive: !o.caseSensitive }));
					return;
				}
				if (activeOptionField === "aiModel") {
					const next =
						AI_MODELS[(AI_MODELS.indexOf(aiModel) + 1) % AI_MODELS.length] ??
						"claude-haiku-4-5";
					setAiModel(next);
					return;
				}
			}
		}
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
									onParamNavigate={handleParamNavigate}
									onValuesChange={handleValuesChange}
									onNewParamNameChange={handleNewParamNameChange}
									onConfirmAddParam={handleConfirmAddParam}
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
