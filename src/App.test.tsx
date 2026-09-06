import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testRender } from "@opentui/react/test-utils";
import { App } from "./App";

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

test("a failed key clear is reported instead of claiming success", async () => {
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
});
