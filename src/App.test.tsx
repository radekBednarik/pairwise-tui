import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testRender } from "@opentui/react/test-utils";
import { App } from "./App";

// Windows has no POSIX file modes — stat reports 666/777 whatever chmod did —
// so the tests that assert on them only mean something elsewhere.
const posixOnly = process.platform === "win32" ? test.skip : test;

let dir: string;
const saved = {
	xdg: process.env.XDG_CONFIG_HOME,
	appData: process.env.APPDATA,
	key: process.env.ANTHROPIC_API_KEY,
};

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-app-test-"));
	process.env.XDG_CONFIG_HOME = dir;
	process.env.APPDATA = dir;
	delete process.env.ANTHROPIC_API_KEY;
});

afterEach(async () => {
	process.env.XDG_CONFIG_HOME = saved.xdg;
	process.env.APPDATA = saved.appData;
	if (saved.key !== undefined) process.env.ANTHROPIC_API_KEY = saved.key;
	await rm(dir, { recursive: true, force: true });
});

async function renderApp() {
	const t = await testRender(<App />, { width: 100, height: 34 });
	await t.flush();
	t.renderer.start();
	await t.flush();

	const realDestroy = t.renderer.destroy.bind(t.renderer);
	let quit = false;
	t.renderer.destroy = () => {
		quit = true;
	};

	const press = async (key: string) => {
		t.mockInput.pressKey(key);
		await t.flush();
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
	const arrow = async (dir: "up" | "down") => {
		t.mockInput.pressArrow(dir);
		await t.flush();
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
		type,
		enter,
		escape: pressEscape,
		tab,
		arrow,
		addParam,
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
		expect(app.frame()).toContain(outPath);

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

test("a failed dialog save does not overwrite the working default config", async () => {
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
		await app.waitFor((f) => !f.includes("Save Test Cases"));
		expect(app.frame()).not.toContain("Saved");

		// Give a buggy write-back time to land before asserting it did not.
		for (let i = 0; i < 10; i++) {
			await new Promise((r) => setTimeout(r, 25));
			await app.flush();
		}
		const config = await waitForConfig(app.flush, () => true);
		expect(config.outputConfig).toEqual({ filePath: badPath, format: "txt" });
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
