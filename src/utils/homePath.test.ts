import { expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { overrideEnv } from "../testing/env";
import { expandHomePath } from "./homePath";

const isWindows = process.platform === "win32";
const HOME = isWindows ? "C:\\Users\\tester" : "/home/tester";

test("a bare ~ becomes the home directory", () => {
	expect(expandHomePath("~", HOME)).toBe(HOME);
});

test("a leading ~/ is resolved against the home directory", () => {
	expect(expandHomePath("~/out/cases.txt", HOME)).toBe(
		join(HOME, "out", "cases.txt"),
	);
});

test("a leading ~\\ (windows style) is resolved on Windows only", () => {
	// A backslash is an ordinary file-name character on Linux, so `~\\x` is a
	// literal relative path there and must reach the file system as typed.
	expect(expandHomePath("~\\out\\cases.txt", HOME)).toBe(
		isWindows ? join(HOME, "out", "cases.txt") : "~\\out\\cases.txt",
	);
});

test("~user forms are left alone", () => {
	expect(expandHomePath("~alice/cases.txt", HOME)).toBe("~alice/cases.txt");
});

test("a ~ that is not leading is left alone", () => {
	expect(expandHomePath("out/~/cases.txt", HOME)).toBe("out/~/cases.txt");
	expect(expandHomePath("cases~.txt", HOME)).toBe("cases~.txt");
});

test("paths without ~ pass through untouched", () => {
	expect(expandHomePath("./cases.txt", HOME)).toBe("./cases.txt");
	expect(expandHomePath("C:\\out\\cases.txt", HOME)).toBe("C:\\out\\cases.txt");
	expect(expandHomePath("", HOME)).toBe("");
});

test("the home directory defaults to the current user's", () => {
	expect(expandHomePath("~/cases.txt")).toBe(join(homedir(), "cases.txt"));
});

test("the default home follows HOME (Linux) / USERPROFILE (Windows) at call time", () => {
	// Bun's os.homedir() on Linux does not see a HOME set after start-up, so
	// the env var has to be read directly for `~` to honour the environment.
	const override = isWindows ? "C:\\Users\\other" : "/home/other";
	const restoreEnv = overrideEnv({ HOME: override, USERPROFILE: override });
	try {
		expect(expandHomePath("~/cases.txt")).toBe(join(override, "cases.txt"));
	} finally {
		restoreEnv();
	}
});
