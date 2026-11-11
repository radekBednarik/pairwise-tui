import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App, type AppUpdateOptions } from "./App";
import { runPict } from "./pict/runner";
import { overrideEnv } from "./testing/env";
import { renderTest } from "./testing/render";
import type { UpdateDeps } from "./update/controller";
import type { Availability, InstallContext } from "./update/platform";
import {
	type AvailableUpdate,
	EMPTY_UPDATE_RECORD,
	type UpdateRecord,
} from "./update/state";
import { INSTALLED_VERSION } from "./update/version";

// Windows has no POSIX file modes — stat reports 666/777 whatever chmod did —
// so the tests that assert on them only mean something elsewhere.
const posixOnly = process.platform === "win32" ? test.skip : test;

let dir: string;
let restoreEnv: () => void = () => {};
const savedKey = process.env.ANTHROPIC_API_KEY;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-app-test-"));
	// Config dir and home dir both point at the temp dir, in the Linux and the
	// Windows spelling, so the settings file and `~` resolve there on both.
	restoreEnv = overrideEnv({
		XDG_CONFIG_HOME: dir,
		APPDATA: dir,
		HOME: dir,
		USERPROFILE: dir,
	});
	delete process.env.ANTHROPIC_API_KEY;
});

afterEach(async () => {
	restoreEnv();
	if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
	await rm(dir, { recursive: true, force: true });
});

async function renderApp(element = <App />) {
	const t = await renderTest(element, { width: 100, height: 34 });

	const realDestroy = t.renderer.destroy.bind(t.renderer);
	let quit = false;
	t.renderer.destroy = () => {
		quit = true;
	};

	const press = async (key: string) => {
		t.mockInput.pressKey(key);
		await t.flush();
	};
	// No flush: for delivering a second key before the previous key's async
	// work (a PICT run) has a chance to finish.
	const pressNoFlush = (key: string) => {
		t.mockInput.pressKey(key);
	};
	const type = async (text: string) => {
		await t.mockInput.typeText(text);
		await t.flush();
	};
	const enter = async () => {
		t.mockInput.pressEnter();
		await t.flush();
	};
	const pressEscape = async () => {
		t.mockInput.pressEscape();
		await t.flush();
	};
	const tab = async () => {
		t.mockInput.pressTab();
		await t.flush();
	};
	// Ctrl+U is OpenTUI's default "delete-to-line-start"; with the cursor at
	// the end of a freshly focused input it empties the whole field.
	const clearInput = async () => {
		t.mockInput.pressKey("u", { ctrl: true });
		await t.flush();
	};
	const arrow = async (dir: "up" | "down" | "left" | "right") => {
		t.mockInput.pressArrow(dir);
		await t.flush();
	};
	const pressCtrl = async (key: string) => {
		t.mockInput.pressKey(key, { ctrl: true });
		await t.flush();
	};
	// Lets async work that finished behind the scenes (a dropped overlay
	// request, a settings write) reach the frame.
	const settle = async () => {
		for (let i = 0; i < 10; i++) {
			await new Promise((r) => setTimeout(r, 25));
			await t.flush();
		}
	};
	const addParam = async (name: string, values: string) => {
		await press("a");
		await type(name);
		await enter();
		await press("e");
		await type(values);
		await pressEscape();
	};

	// Generation and saving run real async work (PICT spawn, file writes), so
	// poll the frame instead of relying on a single flush.
	const waitFor = async (pred: (frame: string) => boolean, timeout = 5000) => {
		const start = Date.now();
		while (!pred(t.captureCharFrame())) {
			if (Date.now() - start > timeout) {
				throw new Error(`waitFor timed out; frame:\n${t.captureCharFrame()}`);
			}
			await new Promise((r) => setTimeout(r, 25));
			await t.flush();
		}
	};

	return {
		frame: () => t.captureCharFrame(),
		flush: () => t.flush(),
		hasQuit: () => quit,
		press,
		pressNoFlush,
		type,
		enter,
		escape: pressEscape,
		tab,
		clearInput,
		arrow,
		pressCtrl,
		addParam,
		settle,
		waitFor,
		cleanup: () => realDestroy(),
	};
}

test("q quits while the parameters panel is focused", async () => {
	const app = await renderApp();
	try {
		await app.press("q");
		expect(app.hasQuit()).toBe(true);
	} finally {
		app.cleanup();
	}
});

test("typing a value containing q does not quit the app", async () => {
	const app = await renderApp();
	try {
		await app.press("a");
		await app.type("Mode");
		await app.enter();
		await app.press("e");
		await app.type("Query");

		expect(app.hasQuit()).toBe(false);
		expect(app.frame()).toContain("Query");
	} finally {
		app.cleanup();
	}
});

test("typing q into the constraints editor does not quit the app", async () => {
	const app = await renderApp();
	try {
		await app.press("c");
		await app.type("q");
		expect(app.hasQuit()).toBe(false);
	} finally {
		app.cleanup();
	}
});

test("typing q into an options text field does not quit the app", async () => {
	const app = await renderApp();
	try {
		await app.press("2");
		await app.tab();
		await app.type("q");
		expect(app.hasQuit()).toBe(false);
		expect(app.frame()).toContain("q");
	} finally {
		app.cleanup();
	}
});

test("deleting the selected parameter shows the remaining parameter's values", async () => {
	const app = await renderApp();
	try {
		await app.addParam("OS", "Linux");
		await app.addParam("Browser", "Chrome");
		await app.arrow("up");
		expect(app.frame()).toContain("Values: OS");

		await app.press("d");

		const frame = app.frame();
		expect(frame).toContain("Values: Browser");
		expect(frame).not.toContain("Linux");
	} finally {
		app.cleanup();
	}
});

test("a parameter with repeated values renders every value", async () => {
	const warnings: string[] = [];
	const realError = console.error;
	console.error = (...args: unknown[]) => {
		warnings.push(args.map(String).join(" "));
	};
	const app = await renderApp();
	try {
		await app.press("a");
		await app.type("Mode");
		await app.enter();
		await app.press("e");
		await app.type("on, on");
		await app.escape();

		expect(app.frame()).toContain("2 values: on, on");
		expect(warnings.filter((w) => w.includes("same key"))).toEqual([]);
	} finally {
		console.error = realError;
		app.cleanup();
	}
});

test("an API key typed into the AI setup overlay is saved on Enter", async () => {
	const app = await renderApp();
	try {
		await app.press("F2");
		expect(app.frame()).toContain("AI Setup");

		await app.type("sk-ant-typed-key");
		await app.enter();
		await app.flush();

		const stored = await Bun.file(
			join(dir, "pairwise-tui", "credentials.json"),
		).json();
		expect(stored.anthropic.apiKey).toBe("sk-ant-typed-key");
	} finally {
		app.cleanup();
	}
});

posixOnly(
	"a failed key clear is reported instead of claiming success",
	async () => {
		const app = await renderApp();
		try {
			await app.press("F2");
			await app.type("sk-ant-typed-key");
			await app.enter();
			await app.flush();

			const configDir = join(dir, "pairwise-tui");
			await Bun.$`chmod 500 ${configDir}`.quiet();
			try {
				await app.press("F2");
				await app.press("d");
				await app.flush();
				await app.flush();
			} finally {
				await Bun.$`chmod 700 ${configDir}`.quiet();
			}

			expect(app.frame()).toContain("Could not clear API key");
		} finally {
			app.cleanup();
		}
	},
);

async function writeAppConfig(config: Record<string, unknown>): Promise<void> {
	await Bun.write(
		join(dir, "pairwise-tui", "config.json"),
		JSON.stringify(config),
	);
}

// The settings autosave is fire-and-forget, so poll the config file until it
// matches (or the attempts run out and the caller's assertion reports it).
async function waitForConfig(
	flush: () => Promise<unknown>,
	pred: (config: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
	const file = Bun.file(join(dir, "pairwise-tui", "config.json"));
	let config: Record<string, unknown> = {};
	for (let i = 0; i < 40; i++) {
		config = await file.json().catch(() => ({}));
		if (pred(config)) break;
		await new Promise((r) => setTimeout(r, 25));
		await flush();
	}
	return config;
}

test("the save-on-generate toggle is enabled in the options tab and persists", async () => {
	const app = await renderApp();
	try {
		await app.flush();
		await app.press("2");
		expect(app.frame()).toContain("Ask where to save:");

		// Tab: filepath -> format -> promptOnGenerate, then toggle.
		await app.tab();
		await app.tab();
		await app.tab();
		await app.enter();
		expect(app.frame()).toContain("● ON");

		const config = await waitForConfig(
			app.flush,
			(c) => c.promptOnGenerate === true,
		);
		expect(config.promptOnGenerate).toBe(true);
	} finally {
		app.cleanup();
	}
});

test("with the prompt setting off, generate shows no save dialog and writes no file", async () => {
	const outPath = join(dir, "cases.txt");
	await writeAppConfig({ outputConfig: { filePath: outPath, format: "txt" } });
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Generated"));

		expect(app.frame()).not.toContain("Save Test Cases");
		expect(await Bun.file(outPath).exists()).toBe(false);
	} finally {
		app.cleanup();
	}
});

test("with the prompt setting on, Escape skips saving", async () => {
	const outPath = join(dir, "cases.txt");
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: outPath, format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Save Test Cases"));
		// The input scrolls a long temp path, so only its tail is guaranteed
		// visible.
		expect(app.frame()).toContain("cases.txt");

		await app.escape();
		expect(app.frame()).not.toContain("Save Test Cases");
		expect(await Bun.file(outPath).exists()).toBe(false);
	} finally {
		app.cleanup();
	}
});

test("with the prompt setting on, Enter saves to the shown path", async () => {
	const outPath = join(dir, "cases.txt");
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: outPath, format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Save Test Cases"));

		await app.enter();
		await app.waitFor((f) => f.includes("Saved"));

		const content = await Bun.file(outPath).text();
		expect(content).toContain("OS");
		expect(content).toContain("Linux");
	} finally {
		app.cleanup();
	}
});

test("a ~-prefixed dialog path saves into the home directory and stays ~ in the config", async () => {
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: "~/cases.txt", format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Save Test Cases"));

		await app.enter();
		await app.waitFor((f) => f.includes("Saved"));

		expect(await Bun.file(join(dir, "cases.txt")).exists()).toBe(true);
		expect(await Bun.file(join("~", "cases.txt")).exists()).toBe(false);
		const config = await waitForConfig(
			app.flush,
			(c) => (c.outputConfig as { filePath?: string })?.filePath !== undefined,
		);
		expect((config.outputConfig as { filePath: string }).filePath).toBe(
			"~/cases.txt",
		);
	} finally {
		app.cleanup();
	}
});

test("cycling the dialog format saves that format and becomes the new default", async () => {
	const outPath = join(dir, "cases.txt");
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: outPath, format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Save Test Cases"));

		await app.arrow("down");
		expect(app.frame()).toContain("JSON");

		await app.enter();
		await app.waitFor((f) => f.includes("Saved"));

		const jsonPath = join(dir, "cases.json");
		const rows = await Bun.file(jsonPath).json();
		expect(rows.every((r: Record<string, string>) => "OS" in r)).toBe(true);

		// Write-back: the confirmed path/format become the persisted default.
		const config = await waitForConfig(
			app.flush,
			(c) =>
				(c.outputConfig as { format?: string } | undefined)?.format === "json",
		);
		expect(config.outputConfig).toEqual({ filePath: jsonPath, format: "json" });
	} finally {
		app.cleanup();
	}
});

test("a failed dialog save keeps the dialog open and does not overwrite the default config", async () => {
	// The path's parent is a regular file, so the write must fail.
	const badPath = join(dir, "blocker", "cases.txt");
	await Bun.write(join(dir, "blocker"), "not a directory");
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: badPath, format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Save Test Cases"));

		// Cycle to json so a (wrong) write-back would be observable in config.
		await app.arrow("down");
		await app.enter();

		// Give the failing save (and a buggy close or write-back) time to land.
		await app.settle();
		// The dialog stays open so the typed path can be corrected and retried.
		expect(app.frame()).toContain("Save Test Cases");
		expect(app.frame()).not.toContain("Saved");
		const config = await waitForConfig(app.flush, () => true);
		expect(config.outputConfig).toEqual({ filePath: badPath, format: "txt" });

		// Escape still dismisses it.
		await app.escape();
		expect(app.frame()).not.toContain("Save Test Cases");
	} finally {
		app.cleanup();
	}
});

test("a typed extension wins over the selected dialog format", async () => {
	// No extension in the default, so typing ".json" completes the file name.
	const basePath = join(dir, "cases");
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: basePath, format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.waitFor((f) => f.includes("Save Test Cases"));
		expect(app.frame()).toContain("TXT");

		await app.type(".json");
		await app.enter();
		await app.waitFor((f) => f.includes("Saved"));

		// The content matches the typed extension, not the TXT selector.
		const rows = await Bun.file(`${basePath}.json`).json();
		expect(rows.every((r: Record<string, string>) => "OS" in r)).toBe(true);

		// And the reconciled pair is what gets persisted as the new default.
		const config = await waitForConfig(
			app.flush,
			(c) =>
				(c.outputConfig as { format?: string } | undefined)?.format === "json",
		);
		expect(config.outputConfig).toEqual({
			filePath: `${basePath}.json`,
			format: "json",
		});
	} finally {
		app.cleanup();
	}
});

test("F2 does not replace the AI prompt overlay", async () => {
	const app = await renderApp();
	try {
		await app.press("F2");
		await app.type("sk-ant-typed-key");
		await app.enter();
		await app.flush();

		await app.press("i");
		expect(app.frame()).toContain("AI Parameter Generator");

		await app.press("F2");
		const frame = app.frame();
		expect(frame).toContain("AI Parameter Generator");
		expect(frame).not.toContain("AI Setup");
	} finally {
		app.cleanup();
	}
});

test("F2 while the docs overlay is open does not open AI setup beneath it", async () => {
	const app = await renderApp();
	try {
		await app.press("?");
		expect(app.frame()).toContain("Pairwise TUI docs");

		await app.press("F2");
		expect(app.frame()).toContain("Pairwise TUI docs");

		await app.escape();
		expect(app.frame()).not.toContain("AI Setup");
	} finally {
		app.cleanup();
	}
});

test("a generation that finishes behind an overlay does not queue a hidden save dialog", async () => {
	const outPath = join(dir, "cases.txt");
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: outPath, format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		// Open the message log before the async PICT run completes: both keys go
		// in back to back, without a flush that would let the run finish first.
		app.pressNoFlush("g");
		app.pressNoFlush("m");
		await app.flush();
		expect(app.frame()).toContain("Message Log");

		// The drop is reported in the status line beneath the log, with the
		// generation result kept in the same message.
		await app.waitFor((f) => f.includes("see the Results tab"));
		expect(app.frame()).toContain("Generated 2 test cases");
		await app.escape();

		await app.settle();
		expect(app.frame()).not.toContain("Save Test Cases");
	} finally {
		app.cleanup();
	}
});

test("a generation that finishes while a text field is being edited does not pop the save dialog", async () => {
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: join(dir, "cases.txt"), format: "txt" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		// Start adding a parameter before the async PICT run completes: the
		// dialog would replace the tab and discard whatever is being typed.
		app.pressNoFlush("g");
		app.pressNoFlush("a");
		await app.flush();

		await app.waitFor((f) => f.includes("press Esc, then"));
		const frame = app.frame();
		expect(frame).not.toContain("Save Test Cases");
		// The edit survives: still on the model tab with the add-param field.
		expect(frame).toContain("New:");
		// Once the edit ends, the promised fallback works.
		await app.escape();
		await app.press("s");
		await app.waitFor((f) => f.includes("Saved"));
		expect(await Bun.file(join(dir, "cases.txt")).exists()).toBe(true);
	} finally {
		app.cleanup();
	}
});

test("a failed generation shows no save dialog even with the prompt setting on", async () => {
	await writeAppConfig({ promptOnGenerate: true });
	const app = await renderApp();
	try {
		await app.flush();
		await app.press("g");
		await app.waitFor((f) => f.includes("Add at least one parameter"));
		expect(app.frame()).not.toContain("Save Test Cases");
	} finally {
		app.cleanup();
	}
});

test("an overlay opened while the model list is loading suppresses the file picker", async () => {
	// Two .pictm files, so [o] must go through the picker (not auto-load).
	await Bun.write(join(dir, "alpha.pictm"), "OS: Linux, Windows\n");
	await Bun.write(join(dir, "beta.pictm"), "OS: Linux, Windows\n");
	await writeAppConfig({
		modelStorage: { storagePath: dir, fileTemplate: "model_{timestamp}" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		// Open the docs before the async directory listing resolves.
		app.pressNoFlush("o");
		app.pressNoFlush("?");
		await app.flush();
		expect(app.frame()).toContain("Pairwise TUI docs");

		// Let the listing finish behind the overlay, then close the docs: the
		// picker must not have been queued up invisibly beneath them.
		await app.settle();
		expect(app.frame()).toContain("Model picker skipped");
		await app.escape();
		const frame = app.frame();
		// Escape must close the docs (the visible overlay), and the picker must
		// not surface behind them.
		expect(frame).not.toContain("Pairwise TUI docs");
		expect(frame).not.toContain("alpha.pictm");
	} finally {
		app.cleanup();
	}
});

test("F2 while a parameter name is being typed does not open AI setup over the input", async () => {
	const app = await renderApp();
	try {
		await app.press("a");
		await app.type("Br");
		await app.press("F2");
		const frame = app.frame();
		expect(frame).not.toContain("AI Setup");
		expect(frame).toContain("New:");
		expect(frame).toContain("Br");
	} finally {
		app.cleanup();
	}
});

test("an overlay opened while a single model file is loading defers the load too", async () => {
	await Bun.write(join(dir, "only.pictm"), "Zeta: Linux, Windows\n");
	await writeAppConfig({
		modelStorage: { storagePath: dir, fileTemplate: "model_{timestamp}" },
	});
	const app = await renderApp();
	try {
		await app.flush();
		app.pressNoFlush("o");
		app.pressNoFlush("?");
		await app.flush();
		expect(app.frame()).toContain("Pairwise TUI docs");

		await app.settle();
		expect(app.frame()).toContain("Model load skipped");
		await app.escape();
		expect(app.frame()).not.toContain("Zeta");
	} finally {
		app.cleanup();
	}
});

test("the save dialog uses the output path as it is when the run finishes, not when [g] was pressed", async () => {
	await writeAppConfig({
		promptOnGenerate: true,
		outputConfig: { filePath: join(dir, "old.txt"), format: "txt" },
	});
	// The run is held open until the test releases it, so the edits below
	// deterministically land while PICT is "still running".
	let release = () => {};
	const gate = new Promise<void>((r) => {
		release = r;
	});
	const heldRunPict: typeof runPict = async (model, options) => {
		await gate;
		return runPict(model, options);
	};
	const app = await renderApp(<App runPict={heldRunPict} />);
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		await app.press("2");
		await app.tab();
		// Ctrl+U clears the field (delete-to-line-start) so the new path
		// replaces the old one instead of being appended to it. Without this
		// the assertion below only held when the temp path was long enough to
		// scroll "old.txt" out of the input's visible window.
		await app.clearInput();
		await app.type(join(dir, "new.txt"));
		await app.enter();
		await app.escape();
		expect(app.frame()).not.toContain("Save Test Cases");

		release();
		await app.waitFor((f) => f.includes("Save Test Cases"));
		expect(app.frame()).toContain("new.txt");
		expect(app.frame()).not.toContain("old.txt");
	} finally {
		app.cleanup();
	}
});

test("the save prompt setting is read when the run finishes, not when [g] was pressed", async () => {
	await writeAppConfig({
		promptOnGenerate: false,
		outputConfig: { filePath: join(dir, "cases.txt"), format: "txt" },
	});
	let release = () => {};
	const gate = new Promise<void>((r) => {
		release = r;
	});
	const heldRunPict: typeof runPict = async (model, options) => {
		await gate;
		return runPict(model, options);
	};
	const app = await renderApp(<App runPict={heldRunPict} />);
	try {
		await app.flush();
		await app.addParam("OS", "Linux, Windows");
		await app.press("g");
		// Turn 'Ask where to save' on while PICT is still running.
		await app.press("2");
		await app.tab();
		await app.tab();
		await app.tab();
		await app.enter();
		expect(app.frame()).toContain("● ON");
		await app.press("3");

		release();
		await app.waitFor((f) => f.includes("Save Test Cases"));
	} finally {
		app.cleanup();
	}
});

test("a highlighted non-text options field survives a tab round trip", async () => {
	const app = await renderApp();
	try {
		await app.press("2");
		await app.tab(); // filepath
		await app.tab(); // format
		await app.press("3");
		await app.press("2");
		await app.enter(); // still on format: cycles to json
		expect(app.frame()).toContain("output_{timestamp}.json");
	} finally {
		app.cleanup();
	}
});

test("saving with no results reports an error instead of doing nothing", async () => {
	const app = await renderApp();
	try {
		await app.press("s");
		expect(app.frame()).toContain("No test cases to save");
	} finally {
		app.cleanup();
	}
});

test("the options tab offers a timestamp template for both output and model files", async () => {
	const app = await renderApp();
	try {
		await app.press("2");
		const frame = app.frame();
		expect(frame).toContain("output_{timestamp}.txt");
		expect(frame.split("{timestamp} = UTC ISO date").length - 1).toBe(2);
	} finally {
		app.cleanup();
	}
});

// ---------------------------------------------------------------------------
// Automatic update (specs/002-auto-update)
// ---------------------------------------------------------------------------

const UPDATE_TARGET = "/opt/app/pairwise-tui";
const UPDATE_SHA = "d".repeat(64);
const NEWER = "99.0.0";

function newerUpdate(over: Partial<AvailableUpdate> = {}): AvailableUpdate {
	return {
		version: NEWER,
		tag: `v${NEWER}`,
		notes: "First line of notes\nSecond line of notes",
		pageUrl: `https://github.com/radekBednarik/pairwise-tui/releases/tag/v${NEWER}`,
		assetName: "pairwise-tui",
		sizeBytes: 5 * 1024 * 1024,
		...over,
	};
}

/** An in-memory update backend: nothing touches the network or the app file. */
function fakeUpdate(
	setup: {
		availability?: Availability;
		record?: Partial<UpdateRecord>;
		check?: () => Promise<AvailableUpdate | null>;
		staged?: boolean;
	} = {},
) {
	const calls: string[] = [];
	let record: UpdateRecord = { ...EMPTY_UPDATE_RECORD, ...setup.record };
	// Swappable after the app (and its controller) was created.
	const current = {
		check: setup.check ?? (async () => newerUpdate()),
	};
	const context: InstallContext = {
		kind: "linux",
		targetPath: UPDATE_TARGET,
		assetName: "pairwise-tui",
		availability: setup.availability ?? "ok",
		identity: "1:2",
	};
	const deps: Partial<UpdateDeps> = {
		getContext: async () => context,
		loadRecord: async () => structuredClone(record),
		saveRecord: async (r) => {
			record = structuredClone(r);
		},
		check: async () => {
			calls.push("check");
			return current.check();
		},
		fetchChecksum: async () => UPDATE_SHA,
		download: async (options) => {
			calls.push("download");
			options.onProgress(options.sizeBytes, options.sizeBytes);
			return UPDATE_SHA;
		},
		install: async () => {
			calls.push("install");
		},
		acquireLock: async () => true,
		releaseLock: async () => {},
		removeStaged: async () => {
			calls.push("removeStaged");
		},
		stagedExists: async () => setup.staged ?? false,
	};
	const options: AppUpdateOptions = {
		deps,
		restart: (version) => calls.push(`restart ${version}`),
	};
	return {
		options,
		calls,
		record: () => record,
		setCheck: (check: () => Promise<AvailableUpdate | null>) => {
			current.check = check;
		},
	};
}

test("a found update is offered after startup with its details and four choices", async () => {
	const update = fakeUpdate();
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.waitFor((f) => f.includes("Update available"));
		const frame = app.frame();
		expect(frame).toContain(`Installed: ${INSTALLED_VERSION}`);
		expect(frame).toContain(`New: ${NEWER}`);
		expect(frame).toContain("Download size: 5.0 MB");
		expect(frame).toContain("First line of notes");
		expect(frame).toContain("Second line of notes");
		const order = [
			"Update now",
			"Update on exit",
			"Not now",
			"Skip this version",
		].map((choice) => frame.indexOf(choice));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		expect(frame).toContain("▶ Not now");
		// Nothing is downloaded before the user chooses.
		expect(update.calls).toEqual(["check"]);

		// Global shortcuts are inactive while the offer is open.
		await app.press("q");
		expect(app.hasQuit()).toBe(false);
		await app.press("2");
		expect(app.frame()).toContain("Update available");

		await app.escape();
		expect(app.frame()).not.toContain("Update available");
		expect(update.record().available?.version).toBe(NEWER);
		expect(update.calls).toEqual(["check"]);
	} finally {
		app.cleanup();
	}
});

test("the interface is drawn and takes keys while the update check is still running", async () => {
	const update = fakeUpdate({ check: () => new Promise(() => {}) });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		expect(update.calls).toEqual(["check"]);
		expect(app.frame()).toContain("1:Model");
		await app.press("2");
		expect(app.frame()).toContain("Output Configuration");
		await app.press("q");
		expect(app.hasQuit()).toBe(true);
	} finally {
		app.cleanup();
	}
});

test("the update offer waits until a text field is left", async () => {
	let found: (u: AvailableUpdate) => void = () => {};
	const update = fakeUpdate({
		check: () =>
			new Promise<AvailableUpdate>((resolve) => {
				found = resolve;
			}),
	});
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.press("a");
		await app.type("Brow");
		found(newerUpdate());
		await app.settle();
		expect(app.frame()).not.toContain("Update available");

		await app.type("ser");
		await app.enter();
		await app.waitFor((f) => f.includes("Update available"));
		await app.escape();
		// The name typed while the offer was waiting was not lost.
		expect(app.frame()).toContain("Browser");
	} finally {
		app.cleanup();
	}
});

test("the update offer waits behind another overlay", async () => {
	let found: (u: AvailableUpdate) => void = () => {};
	const update = fakeUpdate({
		check: () =>
			new Promise<AvailableUpdate>((resolve) => {
				found = resolve;
			}),
	});
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.press("?");
		expect(app.frame()).toContain("Pairwise TUI docs");
		found(newerUpdate());
		await app.settle();
		expect(app.frame()).toContain("Pairwise TUI docs");
		expect(app.frame()).not.toContain("Update available");
		await app.escape();
		await app.waitFor((f) => f.includes("Update available"));
	} finally {
		app.cleanup();
	}
});

test("'Update now' without unsaved work downloads, installs and restarts", async () => {
	const update = fakeUpdate();
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.waitFor((f) => f.includes("Update available"));
		await app.arrow("left");
		await app.arrow("left");
		expect(app.frame()).toContain("▶ Update now");
		await app.enter();
		await app.settle();
		expect(update.calls).toEqual([
			"check",
			"download",
			"install",
			`restart ${NEWER}`,
		]);
		expect(update.record().installedFrom).toBe(INSTALLED_VERSION);
	} finally {
		app.cleanup();
	}
});

test("'Update now' with unsaved work warns first, and 'Go back' returns to the offer", async () => {
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.addParam("Browser", "Chrome, Firefox");

		// Manual check from the Options tab: 11 Tabs reach "Check for updates now".
		update.setCheck(async () => newerUpdate());
		await app.press("2");
		for (let i = 0; i < 11; i++) await app.tab();
		expect(app.frame()).toContain("[Enter] check");
		await app.enter();
		await app.waitFor((f) => f.includes("Update available"));

		await app.arrow("left");
		await app.arrow("left");
		await app.enter();
		await app.waitFor((f) =>
			f.includes("Restarting will discard unsaved work."),
		);
		const frame = app.frame();
		expect(frame).toContain("▶ Go back");
		expect(frame).toContain("Save model first");
		expect(frame).toContain("Update on exit instead");
		expect(update.calls).not.toContain("download");

		await app.enter();
		await app.waitFor((f) => f.includes("Update available"));
		expect(update.calls).not.toContain("download");
	} finally {
		app.cleanup();
	}
});

test("work counts as unsaved until the model is saved, and results until they are saved", async () => {
	await writeAppConfig({
		modelStorage: { storagePath: dir, fileTemplate: "model_{timestamp}" },
	});
	const update = fakeUpdate({ check: async () => newerUpdate() });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.waitFor((f) => f.includes("Update available"));
		await app.escape();
		await app.addParam("Browser", "Chrome, Firefox");

		const offerAndUpdateNow = async () => {
			await app.press("2");
			await app.escape();
			for (let i = 0; i < 11; i++) await app.tab();
			await app.enter();
			await app.waitFor((f) => f.includes("Update available"));
			await app.arrow("left");
			await app.arrow("left");
			await app.enter();
			await app.settle();
		};

		// Saving the model clears the model part; nothing was generated yet.
		await app.press("1");
		await app.press("w");
		await app.waitFor((f) => f.includes("Model saved to"));
		await offerAndUpdateNow();
		expect(app.frame()).not.toContain("Restarting will discard unsaved work.");
		expect(update.calls).toContain(`restart ${NEWER}`);
	} finally {
		app.cleanup();
	}
});

test("generated results that were not saved count as unsaved work", async () => {
	await writeAppConfig({
		modelStorage: { storagePath: dir, fileTemplate: "model_{timestamp}" },
	});
	const update = fakeUpdate({ check: async () => null });
	const fakeRun: typeof runPict = async () => [{ Browser: "Chrome" }];
	const app = await renderApp(
		<App update={update.options} runPict={fakeRun} />,
	);
	try {
		await app.settle();
		await app.addParam("Browser", "Chrome");
		await app.press("w");
		await app.waitFor((f) => f.includes("Model saved to"));
		await app.press("g");
		await app.waitFor((f) => f.includes("Generated 1 test cases"));

		update.setCheck(async () => newerUpdate());
		await app.press("2");
		for (let i = 0; i < 11; i++) await app.tab();
		await app.enter();
		await app.waitFor((f) => f.includes("Update available"));
		await app.arrow("left");
		await app.arrow("left");
		await app.enter();
		await app.waitFor((f) =>
			f.includes("Restarting will discard unsaved work."),
		);
	} finally {
		app.cleanup();
	}
});

test("an install the app cannot modify only gets a notice", async () => {
	const update = fakeUpdate({ availability: "read-only" });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.waitFor((f) => f.includes("Update available"));
		const frame = app.frame();
		expect(frame).toContain(
			"This installation cannot update itself (no write permission).",
		);
		expect(frame).toContain(
			`Download: https://github.com/radekBednarik/pairwise-tui/releases/tag/v${NEWER}`,
		);
		expect(frame).toContain("▶ Close");
		expect(frame).toContain("Skip this version");
		expect(frame).not.toContain("Update now");
		expect(frame).not.toContain("Update on exit");

		await app.enter();
		expect(app.frame()).not.toContain("Update available");
		expect(update.calls).toEqual(["check"]);

		await app.press("2");
		expect(app.frame()).toContain(
			"Self-update unavailable: no write permission for the app's folder",
		);
	} finally {
		app.cleanup();
	}
});

test("the first start after an update says which version now runs", async () => {
	const update = fakeUpdate({
		record: { installedFrom: "0.0.1" },
		check: async () => null,
	});
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.waitFor((f) =>
			f.includes(
				`Updated to ${INSTALLED_VERSION} (previous version kept as pairwise-tui.old)`,
			),
		);
		expect(update.record().installedFrom).toBeNull();
	} finally {
		app.cleanup();
	}
});

for (const how of ["q", "Ctrl+C"] as const) {
	test(`${how} installs an update that waits for exit, then quits`, async () => {
		const update = fakeUpdate({
			staged: true,
			check: async () => null,
			record: {
				pending: {
					version: NEWER,
					mode: "onExit",
					sha256: UPDATE_SHA,
					targetPath: UPDATE_TARGET,
				},
			},
		});
		const app = await renderApp(<App update={update.options} />);
		try {
			await app.settle();
			await app.press("2");
			expect(app.frame()).toContain(`${NEWER} will be installed on exit`);
			await app.press("1");

			if (how === "q") await app.press("q");
			else await app.pressCtrl("c");
			await app.settle();
			expect(update.calls).toContain("install");
			expect(app.hasQuit()).toBe(true);
			expect(update.record().pending).toBeNull();
			expect(update.record().installedFrom).toBe(INSTALLED_VERSION);
		} finally {
			app.cleanup();
		}
	});
}

test("the Options tab shows the Updates section, on by default", async () => {
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.press("2");
		const frame = app.frame();
		expect(frame.indexOf("Updates")).toBeGreaterThan(
			frame.indexOf("AI Settings"),
		);
		expect(frame).toContain(`Version: ${INSTALLED_VERSION}`);
		expect(frame).toMatch(/Automatic updates:\s+● ON/);
		expect(frame).toContain("Check for updates now");
	} finally {
		app.cleanup();
	}
});

test("run from source, the Updates section says updates are unavailable and checks nothing", async () => {
	// No injected backend: this is the real default, and tests run from source.
	const app = await renderApp();
	try {
		await app.settle();
		await app.press("2");
		expect(app.frame()).toContain(
			"Updates unavailable when running from source",
		);
		for (let i = 0; i < 10; i++) await app.tab();
		expect(app.frame()).not.toContain("[Enter] toggle");
		await app.enter();
		expect(app.frame()).toMatch(/Automatic updates:\s+● ON/);
	} finally {
		app.cleanup();
	}
});

test("turning automatic updates off persists and stops the startup check", async () => {
	const first = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={first.options} />);
	try {
		await app.settle();
		expect(first.calls).toEqual(["check"]);
		await app.press("2");
		for (let i = 0; i < 10; i++) await app.tab();
		expect(app.frame()).toContain("[Enter] toggle");
		await app.enter();
		expect(app.frame()).toMatch(/Automatic updates:\s+○ OFF/);
		const config = await waitForConfig(
			app.flush,
			(c) => c.autoUpdate === false,
		);
		expect(config.autoUpdate).toBe(false);
	} finally {
		app.cleanup();
	}

	const second = fakeUpdate();
	const again = await renderApp(<App update={second.options} />);
	try {
		await again.settle();
		expect(second.calls).toEqual([]);
		expect(again.frame()).not.toContain("Update available");

		// The manual check still works with the setting off.
		await again.press("2");
		expect(again.frame()).toMatch(/Automatic updates:\s+○ OFF/);
		for (let i = 0; i < 11; i++) await again.tab();
		await again.enter();
		await again.waitFor((f) => f.includes("Update available"));
		expect(second.calls).toEqual(["check"]);
	} finally {
		again.cleanup();
	}
});

test("the manual check reports being up to date and a failed check", async () => {
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.press("2");
		for (let i = 0; i < 11; i++) await app.tab();
		await app.enter();
		await app.waitFor((f) =>
			f.includes(`You are up to date (${INSTALLED_VERSION})`),
		);

		update.setCheck(async () => {
			throw new Error("HTTP 403");
		});
		await app.enter();
		await app.waitFor((f) => f.includes("Update check failed: HTTP 403"));
		expect(app.frame()).toContain("Last update check failed: HTTP 403");
	} finally {
		app.cleanup();
	}
});

test("a failed automatic check interrupts nothing and lands in the message log", async () => {
	const update = fakeUpdate({
		check: async () => {
			throw new Error("offline");
		},
	});
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		expect(app.frame()).not.toContain("Update check failed");
		expect(app.frame()).not.toContain("Update available");
		await app.press("m");
		expect(app.frame()).toContain("Update check failed: offline");
	} finally {
		app.cleanup();
	}
});

/** Manual check from the Options tab, then "Update now" on the offer. */
async function manualCheckAndUpdateNow(
	app: Awaited<ReturnType<typeof renderApp>>,
): Promise<void> {
	await app.press("2");
	await app.escape();
	for (let i = 0; i < 11; i++) await app.tab();
	await app.enter();
	await app.waitFor((f) => f.includes("Update available"));
	await app.arrow("left");
	await app.arrow("left");
	await app.enter();
	await app.settle();
}

test("a model opened from storage is not unsaved work", async () => {
	await Bun.write(join(dir, "only.pictm"), "Zeta: Linux, Windows\n");
	await writeAppConfig({
		modelStorage: { storagePath: dir, fileTemplate: "model_{timestamp}" },
	});
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.press("o");
		await app.waitFor((f) => f.includes("Loaded model from"));
		expect(app.frame()).toContain("Zeta");

		update.setCheck(async () => newerUpdate());
		await manualCheckAndUpdateNow(app);
		expect(app.frame()).not.toContain("Restarting will discard unsaved work.");
		expect(update.calls).toContain(`restart ${NEWER}`);
	} finally {
		app.cleanup();
	}
});

test("an opened model that was then changed is unsaved work", async () => {
	await Bun.write(join(dir, "only.pictm"), "Zeta: Linux, Windows\n");
	await writeAppConfig({
		modelStorage: { storagePath: dir, fileTemplate: "model_{timestamp}" },
	});
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.press("o");
		await app.waitFor((f) => f.includes("Loaded model from"));
		await app.addParam("Browser", "Chrome");

		update.setCheck(async () => newerUpdate());
		await manualCheckAndUpdateNow(app);
		expect(app.frame()).toContain("Restarting will discard unsaved work.");
		expect(update.calls).not.toContain("download");
	} finally {
		app.cleanup();
	}
});

test("clearing the model leaves no unsaved work", async () => {
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		await app.addParam("Browser", "Chrome, Firefox");
		await app.press("x");
		await app.arrow("up");
		await app.enter();
		await app.waitFor((f) => f.includes("Model cleared"));

		update.setCheck(async () => newerUpdate());
		await manualCheckAndUpdateNow(app);
		expect(app.frame()).not.toContain("Restarting will discard unsaved work.");
		expect(update.calls).toContain(`restart ${NEWER}`);
	} finally {
		app.cleanup();
	}
});

test("an offer found by the manual check waits until a text field is left", async () => {
	const update = fakeUpdate({ check: async () => null });
	const app = await renderApp(<App update={update.options} />);
	try {
		await app.settle();
		let found: (u: AvailableUpdate) => void = () => {};
		update.setCheck(
			() =>
				new Promise<AvailableUpdate>((resolve) => {
					found = resolve;
				}),
		);
		await app.press("2");
		for (let i = 0; i < 11; i++) await app.tab();
		await app.enter();

		// While the check runs: on to the output path field, and type into it.
		await app.tab();
		await app.tab();
		await app.type("x");
		found(newerUpdate());
		await app.settle();
		expect(app.frame()).not.toContain("Update available");
		expect(app.frame()).toContain("Output file path:");

		// Leaving the field lets the offer through, and the text survives.
		await app.escape();
		await app.waitFor((f) => f.includes("Update available"));
		await app.escape();
		expect(app.frame()).toContain("./output_{timestamp}.txtx");
	} finally {
		app.cleanup();
	}
});
