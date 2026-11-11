import { expect, test } from "bun:test";
import type { SetStateAction } from "react";
import { AI_MODELS, type OPTION_FIELDS } from "../../constants";
import { FORMAT_EXTENSIONS } from "../../output/writer";
import type { AiModel, OutputConfig, PictOptions } from "../../types";
import { handleOptionsTabKeys } from "./optionsTabHandlers";

const RETURN = { name: "return", ctrl: false };

function harness(overrides: {
	activeOptionField: (typeof OPTION_FIELDS)[number];
	outputConfig?: OutputConfig;
	options?: PictOptions;
	aiModel?: AiModel;
	promptOnGenerate?: boolean;
	autoUpdate?: boolean;
	updatesAvailable?: boolean;
}) {
	let outputConfig: OutputConfig = overrides.outputConfig ?? {
		filePath: "./output.txt",
		format: "txt",
	};
	let options: PictOptions = overrides.options ?? {
		order: 2,
		randomize: false,
		caseSensitive: false,
	};
	let aiModel: AiModel = overrides.aiModel ?? "claude-sonnet-5-5";
	let promptOnGenerate = overrides.promptOnGenerate ?? false;
	let autoUpdate = overrides.autoUpdate ?? true;
	let checks = 0;

	const actions = {
		activeOptionField: overrides.activeOptionField,
		get outputConfig() {
			return outputConfig;
		},
		get options() {
			return options;
		},
		get aiModel() {
			return aiModel;
		},
		aiModels: AI_MODELS,
		formatExtensions: FORMAT_EXTENSIONS,
		setActiveOptionField: () => {},
		setOutputConfig: (cfg: OutputConfig) => {
			outputConfig = cfg;
		},
		setOptions: (update: SetStateAction<PictOptions>) => {
			options = typeof update === "function" ? update(options) : update;
		},
		setAiModel: (m: AiModel) => {
			aiModel = m;
		},
		get promptOnGenerate() {
			return promptOnGenerate;
		},
		setPromptOnGenerate: (v: boolean) => {
			promptOnGenerate = v;
		},
		get autoUpdate() {
			return autoUpdate;
		},
		setAutoUpdate: (v: boolean) => {
			autoUpdate = v;
		},
		updatesAvailable: overrides.updatesAvailable ?? true,
		checkForUpdates: () => {
			checks++;
		},
	};

	return {
		actions,
		result: () => ({
			outputConfig,
			options,
			aiModel,
			promptOnGenerate,
			autoUpdate,
			checks,
		}),
	};
}

test("Enter on the format field cycles to the next format", () => {
	const h = harness({ activeOptionField: "format" });
	expect(handleOptionsTabKeys(RETURN, h.actions)).toBe(true);
	expect(h.result().outputConfig.format).toBe("json");
});

test("cycling the format rewrites the output file extension", () => {
	const h = harness({
		activeOptionField: "format",
		outputConfig: { filePath: "./cases.txt", format: "txt" },
	});
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().outputConfig.filePath).toBe("./cases.json");
});

test("every format is reachable and the cycle wraps around", () => {
	const seen: string[] = [];
	const h = harness({ activeOptionField: "format" });
	for (let i = 0; i < Object.keys(FORMAT_EXTENSIONS).length; i++) {
		handleOptionsTabKeys(RETURN, h.actions);
		seen.push(h.result().outputConfig.format);
	}
	expect(seen).toEqual(["json", "csv", "xlsx", "md", "txt"]);
});

test("Enter toggles randomize", () => {
	const h = harness({ activeOptionField: "randomize" });
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().options.randomize).toBe(true);
});

test("Enter toggles case sensitivity", () => {
	const h = harness({ activeOptionField: "caseSensitive" });
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().options.caseSensitive).toBe(true);
});

test("Enter toggles the save-on-generate prompt", () => {
	const h = harness({ activeOptionField: "promptOnGenerate" });
	expect(handleOptionsTabKeys(RETURN, h.actions)).toBe(true);
	expect(h.result().promptOnGenerate).toBe(true);
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().promptOnGenerate).toBe(false);
});

test("Enter on the ai model field cycles through the models and wraps", () => {
	const h = harness({ activeOptionField: "aiModel" });
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().aiModel).toBe("claude-opus-5-5");
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().aiModel).toBe("claude-fable-5-2");
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().aiModel).toBe("claude-haiku-5-5");
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().aiModel).toBe("claude-sonnet-5-5");
});

test("keys other than Enter are not handled", () => {
	const h = harness({ activeOptionField: "format" });
	expect(handleOptionsTabKeys({ name: "x", ctrl: false }, h.actions)).toBe(
		false,
	);
	expect(h.result().outputConfig.format).toBe("txt");
});

test("Enter on a text field is not handled here", () => {
	const h = harness({ activeOptionField: "filepath" });
	expect(handleOptionsTabKeys(RETURN, h.actions)).toBe(false);
});

test("cycling the format keeps a templated path that has no extension", () => {
	const h = harness({
		activeOptionField: "format",
		outputConfig: { filePath: "./output_{timestamp}", format: "txt" },
	});
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().outputConfig.filePath).toBe("./output_{timestamp}.json");
});

test("cycling the format keeps a directory that contains a dot", () => {
	const h = harness({
		activeOptionField: "format",
		outputConfig: { filePath: "out.d/results_{timestamp}.txt", format: "txt" },
	});
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().outputConfig.filePath).toBe(
		"out.d/results_{timestamp}.json",
	);
});

test("cycling the format keeps a windows directory that contains a dot", () => {
	const h = harness({
		activeOptionField: "format",
		outputConfig: { filePath: "out.d\\cases", format: "txt" },
	});
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().outputConfig.filePath).toBe("out.d\\cases.json");
});

test("cycling the format on an empty path still yields a usable name", () => {
	const h = harness({
		activeOptionField: "format",
		outputConfig: { filePath: "", format: "txt" },
	});
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().outputConfig.filePath).toBe("output.json");
});

test("Enter on the automatic updates field toggles it", () => {
	const h = harness({ activeOptionField: "autoUpdate" });
	expect(handleOptionsTabKeys(RETURN, h.actions)).toBe(true);
	expect(h.result().autoUpdate).toBe(false);
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().autoUpdate).toBe(true);
});

test("Enter on the check field starts a manual update check", () => {
	const h = harness({ activeOptionField: "checkUpdates" });
	expect(handleOptionsTabKeys(RETURN, h.actions)).toBe(true);
	expect(h.result().checks).toBe(1);
	expect(h.result().autoUpdate).toBe(true);
});

test("the update fields do nothing when the app cannot update", () => {
	const toggle = harness({
		activeOptionField: "autoUpdate",
		updatesAvailable: false,
	});
	expect(handleOptionsTabKeys(RETURN, toggle.actions)).toBe(true);
	expect(toggle.result().autoUpdate).toBe(true);

	const check = harness({
		activeOptionField: "checkUpdates",
		updatesAvailable: false,
	});
	expect(handleOptionsTabKeys(RETURN, check.actions)).toBe(true);
	expect(check.result().checks).toBe(0);
});
