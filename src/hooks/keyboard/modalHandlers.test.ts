import { expect, test } from "bun:test";
import { FORMAT_EXTENSIONS } from "../../output/writer";
import type { OutputFormat } from "../../types";
import { handleGenerateSaveKeys } from "./modalHandlers";

const key = (name: string) => ({ name, ctrl: false });

function harness(
	overrides: {
		path?: string;
		format?: OutputFormat;
		liveText?: string;
		busy?: boolean;
	} = {},
) {
	let path = overrides.path ?? "./output_{timestamp}.txt";
	let format: OutputFormat = overrides.format ?? "txt";
	let closed = false;

	const actions = {
		get generateSaveFormat() {
			return format;
		},
		formatExtensions: FORMAT_EXTENSIONS,
		isBusy: () => overrides.busy ?? false,
		// Stands in for the live <input> text - may differ from the state path.
		getGenerateSavePath: () => overrides.liveText ?? path,
		setGenerateSavePath: (v: string) => {
			path = v;
		},
		setGenerateSaveFormat: (f: OutputFormat) => {
			format = f;
		},
		closeGenerateSave: () => {
			closed = true;
		},
	};

	return {
		actions,
		result: () => ({ path, format, closed }),
	};
}

test("Escape closes the dialog", () => {
	const h = harness();
	expect(handleGenerateSaveKeys(key("escape"), h.actions)).toBe(true);
	expect(h.result().closed).toBe(true);
});

test("Down cycles to the next format and rewrites the extension", () => {
	const h = harness();
	handleGenerateSaveKeys(key("down"), h.actions);
	expect(h.result().format).toBe("json");
	expect(h.result().path).toBe("./output_{timestamp}.json");
});

test("Up cycles to the previous format and wraps around", () => {
	const h = harness();
	handleGenerateSaveKeys(key("up"), h.actions);
	expect(h.result().format).toBe("md");
	expect(h.result().path).toBe("./output_{timestamp}.md");
});

test("Down from the last format wraps to the first", () => {
	const h = harness({ path: "./cases.md", format: "md" });
	handleGenerateSaveKeys(key("down"), h.actions);
	expect(h.result().format).toBe("txt");
	expect(h.result().path).toBe("./cases.txt");
});

test("cycling reads the live input text, not the stale state path", () => {
	const h = harness({ path: "./stale.txt", liveText: "./edited_by_user.txt" });
	handleGenerateSaveKeys(key("down"), h.actions);
	expect(h.result().path).toBe("./edited_by_user.json");
});

test("Enter is swallowed without side effects (the input's onSubmit saves)", () => {
	const h = harness();
	expect(handleGenerateSaveKeys(key("return"), h.actions)).toBe(true);
	expect(h.result()).toEqual({
		path: "./output_{timestamp}.txt",
		format: "txt",
		closed: false,
	});
});

test("other keys are swallowed so global shortcuts stay inert", () => {
	const h = harness();
	for (const name of ["g", "s", "q", "tab"]) {
		expect(handleGenerateSaveKeys(key(name), h.actions)).toBe(true);
	}
	expect(h.result().closed).toBe(false);
	expect(h.result().format).toBe("txt");
});

test("Escape is ignored while a save is in flight", () => {
	const h = harness({ busy: true });
	expect(handleGenerateSaveKeys(key("escape"), h.actions)).toBe(true);
	expect(h.result().closed).toBe(false);
});

test("format cycling is ignored while a save is in flight", () => {
	const h = harness({ busy: true });
	handleGenerateSaveKeys(key("down"), h.actions);
	expect(h.result().format).toBe("txt");
	expect(h.result().path).toBe("./output_{timestamp}.txt");
});
