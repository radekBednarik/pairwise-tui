import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearApiKey, loadApiKey, saveApiKey } from "./credentials";

let dir: string;
const saved = {
	xdg: process.env.XDG_CONFIG_HOME,
	appData: process.env.APPDATA,
	key: process.env.ANTHROPIC_API_KEY,
};

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-credentials-test-"));
	process.env.XDG_CONFIG_HOME = dir;
	process.env.APPDATA = dir;
	process.env.ANTHROPIC_API_KEY = undefined;
	delete process.env.ANTHROPIC_API_KEY;
});

afterEach(async () => {
	process.env.XDG_CONFIG_HOME = saved.xdg;
	process.env.APPDATA = saved.appData;
	if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY;
	else process.env.ANTHROPIC_API_KEY = saved.key;
	await rm(dir, { recursive: true, force: true });
});

const credentialsPath = () => join(dir, "pairwise-tui", "credentials.json");

test("a saved key is read back", async () => {
	await saveApiKey("sk-ant-secret");
	expect(await loadApiKey()).toBe("sk-ant-secret");
});

test("the environment variable takes precedence over the stored key", async () => {
	await saveApiKey("sk-ant-stored");
	process.env.ANTHROPIC_API_KEY = "sk-ant-env";
	expect(await loadApiKey()).toBe("sk-ant-env");
});

test("clearing removes the key but keeps other entries in the file", async () => {
	await saveApiKey("sk-ant-secret");
	const path = credentialsPath();
	const withExtra = JSON.parse(await Bun.file(path).text());
	withExtra.other = { keep: true };
	await Bun.write(path, JSON.stringify(withExtra));

	await clearApiKey();

	expect(await loadApiKey()).toBeNull();
	expect(JSON.parse(await Bun.file(path).text())).toEqual({
		other: { keep: true },
	});
});

test("the credentials file is not readable by other users", async () => {
	await saveApiKey("sk-ant-secret");
	const mode = (await stat(credentialsPath())).mode & 0o777;
	expect(mode.toString(8)).toBe("600");
});

test("overwriting an existing credentials file keeps it private", async () => {
	const path = credentialsPath();
	await Bun.write(path, "{}");
	await Bun.$`chmod 644 ${path}`.quiet();

	await saveApiKey("sk-ant-secret");

	const mode = (await stat(path)).mode & 0o777;
	expect(mode.toString(8)).toBe("600");
});

test("clearing the key keeps the file private", async () => {
	await saveApiKey("sk-ant-secret");
	await clearApiKey();
	const mode = (await stat(credentialsPath())).mode & 0o777;
	expect(mode.toString(8)).toBe("600");
});

test("the config directory it creates is not listable by other users", async () => {
	await saveApiKey("sk-ant-secret");
	const mode = (await stat(join(dir, "pairwise-tui"))).mode & 0o777;
	expect(mode.toString(8)).toBe("700");
});

test("saving does not write the key through a symlink planted at the credentials path", async () => {
	const outside = join(dir, "outside.json");
	await Bun.write(outside, "untouched");
	await Bun.$`mkdir -p ${join(dir, "pairwise-tui")}`.quiet();
	await Bun.$`ln -s ${outside} ${credentialsPath()}`.quiet();

	await saveApiKey("sk-ant-secret");

	expect(await Bun.file(outside).text()).toBe("untouched");
	expect(await loadApiKey()).toBe("sk-ant-secret");
	const mode = (await stat(credentialsPath())).mode & 0o777;
	expect(mode.toString(8)).toBe("600");
});

test("clearing a key that cannot be written reports the failure", async () => {
	await saveApiKey("sk-ant-secret");
	const configDir = join(dir, "pairwise-tui");
	await Bun.$`chmod 500 ${configDir}`.quiet();
	try {
		await expect(clearApiKey()).rejects.toThrow();
	} finally {
		await Bun.$`chmod 700 ${configDir}`.quiet();
	}
	expect(await loadApiKey()).toBe("sk-ant-secret");
});

test("clearing a key stored in an unparseable file still removes it", async () => {
	await saveApiKey("sk-ant-secret");
	await Bun.write(credentialsPath(), '{"anthropic": {"apiKey": "sk-ant-tru');

	await clearApiKey();

	expect(await loadApiKey()).toBeNull();
});

test("clearing when nothing is stored is not an error", async () => {
	await clearApiKey();
	expect(await loadApiKey()).toBeNull();
});
