import { expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { expandHomePath } from "./homePath";

const HOME =
	process.platform === "win32" ? "C:\\Users\\tester" : "/home/tester";

test("a bare ~ becomes the home directory", () => {
	expect(expandHomePath("~", HOME)).toBe(HOME);
});

test("a leading ~/ is resolved against the home directory", () => {
	expect(expandHomePath("~/out/cases.txt", HOME)).toBe(
		join(HOME, "out", "cases.txt"),
	);
});

test("a leading ~\\ (windows style) is resolved the same way", () => {
	expect(expandHomePath("~\\out\\cases.txt", HOME)).toBe(
		join(HOME, "out", "cases.txt"),
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
