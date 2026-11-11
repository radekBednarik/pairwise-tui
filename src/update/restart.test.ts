import { expect, test } from "bun:test";
import { restartInto } from "./restart";

function harness() {
	const printed: string[] = [];
	const execCalls: Array<{ file: string; args: string[]; env: unknown }> = [];
	const spawnCalls: Array<{ cmd: string[]; options: unknown }> = [];
	return {
		printed,
		execCalls,
		spawnCalls,
		print: (line: string) => printed.push(line),
		execve: (file: string, args: string[], env: unknown) => {
			execCalls.push({ file, args, env });
		},
		spawn: (cmd: string[], options: unknown) => {
			spawnCalls.push({ cmd, options });
			return { exited: Promise.resolve(3) };
		},
	};
}

const FALLBACK = "Updated to 1.8.0. Please start pairwise-tui again.";

test("linux replaces the process image with the new file", async () => {
	const h = harness();
	await restartInto({
		kind: "linux",
		target: "/opt/pairwise-tui",
		version: "1.8.0",
		args: ["--flag"],
		env: { HOME: "/home/u" },
		execve: h.execve,
		spawn: h.spawn,
		print: h.print,
	});
	expect(h.execCalls).toEqual([
		{
			file: "/opt/pairwise-tui",
			args: ["/opt/pairwise-tui", "--flag"],
			env: { HOME: "/home/u" },
		},
	]);
	expect(h.spawnCalls).toEqual([]);
});

test("an AppImage restarts without the old mount's variables", async () => {
	const h = harness();
	await restartInto({
		kind: "appimage",
		target: "/home/u/Apps/Pairwise-TUI-x86_64.AppImage",
		version: "1.8.0",
		args: [],
		env: {
			HOME: "/home/u",
			APPIMAGE: "/home/u/Apps/Pairwise-TUI-x86_64.AppImage",
			APPDIR: "/tmp/.mount_old",
			ARGV0: "./Pairwise-TUI-x86_64.AppImage",
			OWD: "/home/u",
		},
		execve: h.execve,
		spawn: h.spawn,
		print: h.print,
	});
	expect(h.execCalls).toHaveLength(1);
	expect(h.execCalls[0]?.file).toBe(
		"/home/u/Apps/Pairwise-TUI-x86_64.AppImage",
	);
	expect(h.execCalls[0]?.env).toEqual({ HOME: "/home/u" });
});

test("windows runs the new file as a waited child and passes its exit code on", async () => {
	const h = harness();
	const code = await restartInto({
		kind: "windows",
		target: "C:\\Tools\\pairwise-tui.exe",
		version: "1.8.0",
		args: ["--flag"],
		env: {},
		execve: h.execve,
		spawn: h.spawn,
		print: h.print,
	});
	expect(code).toBe(3);
	expect(h.execCalls).toEqual([]);
	expect(h.spawnCalls).toHaveLength(1);
	expect(h.spawnCalls[0]?.cmd).toEqual([
		"C:\\Tools\\pairwise-tui.exe",
		"--flag",
	]);
	expect(h.spawnCalls[0]?.options).toEqual({
		stdio: ["inherit", "inherit", "inherit"],
	});
	expect(h.printed).toEqual([]);
});

test("a failing execve falls back to asking for a manual start", async () => {
	const h = harness();
	const code = await restartInto({
		kind: "linux",
		target: "/opt/pairwise-tui",
		version: "1.8.0",
		args: [],
		env: {},
		execve: () => {
			throw new Error("EACCES");
		},
		spawn: h.spawn,
		print: h.print,
	});
	expect(code).toBe(0);
	expect(h.printed).toEqual([FALLBACK]);
});

test("a missing execve falls back the same way", async () => {
	const h = harness();
	const code = await restartInto({
		kind: "linux",
		target: "/opt/pairwise-tui",
		version: "1.8.0",
		args: [],
		env: {},
		execve: undefined,
		spawn: h.spawn,
		print: h.print,
	});
	expect(code).toBe(0);
	expect(h.printed).toEqual([FALLBACK]);
});

test("a failing spawn falls back to asking for a manual start", async () => {
	const h = harness();
	const code = await restartInto({
		kind: "windows",
		target: "C:\\Tools\\pairwise-tui.exe",
		version: "1.8.0",
		args: [],
		env: {},
		execve: h.execve,
		spawn: () => {
			throw new Error("ENOENT");
		},
		print: h.print,
	});
	expect(code).toBe(0);
	expect(h.printed).toEqual([FALLBACK]);
});
