import { expect, test } from "bun:test";
import type { SetStateAction } from "react";
import { AI_MODELS, OPTION_FIELDS } from "../../constants";
import { FORMAT_EXTENSIONS } from "../../output/writer";
import type { AiModel, OutputConfig, PictOptions } from "../../types";
import { handleOptionsTabKeys } from "./optionsTabHandlers";

const RETURN = { name: "return", ctrl: false };

function harness(overrides: {
	activeOptionField: (typeof OPTION_FIELDS)[number];
	outputConfig?: OutputConfig;
	options?: PictOptions;
	aiModel?: AiModel;
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
	};

	return {
		actions,
		result: () => ({ outputConfig, options, aiModel }),
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
