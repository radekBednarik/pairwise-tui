import { expect, test } from "bun:test";
import { FORMAT_EXTENSIONS } from "../../output/writer";
import type { OutputFormat } from "../../types";
import { handleGenerateSaveKeys, handleUpdateKeys } from "./modalHandlers";

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

function updateHarness() {
	const calls: string[] = [];
	const actions = {
		moveChoice: (delta: number) => calls.push(`move ${delta}`),
		scrollNotes: (delta: number) => calls.push(`scroll ${delta}`),
		confirm: () => calls.push("confirm"),
		escape: () => calls.push("escape"),
	};
	return { calls, actions };
}

test("update overlay: left, right and Tab move between the choices", () => {
	const h = updateHarness();
	for (const name of ["left", "right", "tab"]) {
		expect(handleUpdateKeys(key(name), h.actions)).toBe(true);
	}
	expect(h.calls).toEqual(["move -1", "move 1", "move 1"]);
});

test("update overlay: arrows and page keys scroll the release notes", () => {
	const h = updateHarness();
	for (const name of ["up", "down", "pageup", "pagedown"]) {
		expect(handleUpdateKeys(key(name), h.actions)).toBe(true);
	}
	expect(h.calls).toEqual(["scroll -1", "scroll 1", "scroll -10", "scroll 10"]);
});

test("update overlay: Enter confirms and Escape backs out", () => {
	const h = updateHarness();
	expect(handleUpdateKeys(key("return"), h.actions)).toBe(true);
	expect(handleUpdateKeys(key("escape"), h.actions)).toBe(true);
	expect(h.calls).toEqual(["confirm", "escape"]);
});

test("update overlay: every other key is swallowed, so no global shortcut fires", () => {
	const h = updateHarness();
	for (const name of ["q", "g", "s", "o", "w", "1", "2", "3", "m", "i", "t"]) {
		expect(handleUpdateKeys(key(name), h.actions)).toBe(true);
	}
	expect(h.calls).toEqual([]);
});
