import { expect, test } from "bun:test";
import pkg from "../../package.json";
import { INSTALLED_VERSION, isNewer, parseVersion } from "./version";

test("parseVersion accepts plain and v-prefixed versions", () => {
	expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
	expect(parseVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
	expect(parseVersion("10.20.30")).toEqual({ major: 10, minor: 20, patch: 30 });
});

test("parseVersion rejects anything that is not X.Y.Z", () => {
	for (const bad of [
		"1.2",
		"v1.2.3-beta",
		"1.2.3.4",
		"",
		" 1.2.3",
		"1.2.3\n",
		"V1.2.3",
		"a.b.c",
		null,
		undefined,
		123,
		{},
	]) {
		expect(parseVersion(bad)).toBeNull();
	}
});

test("isNewer compares each component numerically", () => {
	expect(isNewer("1.10.0", "1.9.9")).toBe(true);
	expect(isNewer("2.0.0", "1.99.99")).toBe(true);
	expect(isNewer("1.7.1", "1.7.0")).toBe(true);
	expect(isNewer("v1.8.0", "1.7.0")).toBe(true);
});

test("isNewer is false for equal, lower and invalid versions", () => {
	expect(isNewer("1.7.0", "1.7.0")).toBe(false);
	expect(isNewer("1.6.9", "1.7.0")).toBe(false);
	expect(isNewer("0.99.0", "1.0.0")).toBe(false);
	expect(isNewer("nonsense", "1.7.0")).toBe(false);
	expect(isNewer("1.8.0", "nonsense")).toBe(false);
});

test("the installed version is the package.json version", () => {
	expect(INSTALLED_VERSION).toBe(pkg.version);
	expect(parseVersion(INSTALLED_VERSION)).not.toBeNull();
});
