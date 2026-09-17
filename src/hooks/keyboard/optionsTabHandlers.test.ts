import { expect, test } from "bun:test";
import type { SetStateAction } from "react";
import { AI_MODELS, OPTION_FIELDS } from "../../constants";
import { FORMAT_EXTENSIONS } from "../../output/writer";
import type { AiModel, OutputConfig, PictOptions } from "../../types";
import {
	formatFromExtension,
	handleOptionsTabKeys,
} from "./optionsTabHandlers";

const RETURN = { name: "return", ctrl: false };

function harness(overrides: {
	activeOptionField: (typeof OPTION_FIELDS)[number];
	outputConfig?: OutputConfig;
	options?: PictOptions;
	aiModel?: AiModel;
	promptOnGenerate?: boolean;
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
	let aiModel: AiModel = overrides.aiModel ?? "claude-haiku-4-5";
	let promptOnGenerate = overrides.promptOnGenerate ?? false;

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
		optionFields: OPTION_FIELDS,
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
	};

	return {
		actions,
		result: () => ({ outputConfig, options, aiModel, promptOnGenerate }),
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

test("Enter on the ai model field cycles to the next model", () => {
	const h = harness({ activeOptionField: "aiModel" });
	handleOptionsTabKeys(RETURN, h.actions);
	expect(h.result().aiModel).toBe("claude-sonnet-5");
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

test("a known typed extension maps back to its format", () => {
	expect(formatFromExtension("out/cases.json", FORMAT_EXTENSIONS)).toBe("json");
	expect(formatFromExtension("cases.csv", FORMAT_EXTENSIONS)).toBe("csv");
	expect(formatFromExtension("cases.md", FORMAT_EXTENSIONS)).toBe("md");
});

test("extension matching ignores case", () => {
	expect(formatFromExtension("CASES.JSON", FORMAT_EXTENSIONS)).toBe("json");
});

test("an unknown extension resolves to null", () => {
	expect(formatFromExtension("cases.foo", FORMAT_EXTENSIONS)).toBeNull();
});

test("a path without an extension resolves to null", () => {
	expect(
		formatFromExtension("cases_{timestamp}", FORMAT_EXTENSIONS),
	).toBeNull();
});

test("a dot inside a directory is not an extension", () => {
	expect(formatFromExtension("out.d/cases", FORMAT_EXTENSIONS)).toBeNull();
	expect(formatFromExtension("out.d\\cases", FORMAT_EXTENSIONS)).toBeNull();
});

test("a dotfile name is not an extension", () => {
	expect(formatFromExtension(".json", FORMAT_EXTENSIONS)).toBeNull();
});
