import { expect, test } from "bun:test";
import { buildDefines, COMPILE_HARDENING } from "./build-common";

test("a normal build is marked as a release build and nothing else", () => {
	expect(buildDefines({})).toEqual({ __RELEASE_BUILD__: "true" });
});

test("the override is baked in for a local rig build", () => {
	expect(
		buildDefines({ UPDATE_SOURCE_OVERRIDE: "http://localhost:8787" }),
	).toEqual({
		__RELEASE_BUILD__: "true",
		__UPDATE_SOURCE_OVERRIDE__: '"http://localhost:8787"',
	});
});

test("the override is refused on CI, where published builds are made", () => {
	for (const ci of [{ GITHUB_ACTIONS: "true" }, { CI: "true" }, { CI: "1" }]) {
		expect(() =>
			buildDefines({ UPDATE_SOURCE_OVERRIDE: "http://localhost:8787", ...ci }),
		).toThrow("UPDATE_SOURCE_OVERRIDE");
	}
	expect(buildDefines({ CI: "true" })).toEqual({ __RELEASE_BUILD__: "true" });
});

test("compiled executables load no configuration from the current directory", () => {
	expect(COMPILE_HARDENING).toEqual({
		autoloadDotenv: false,
		autoloadBunfig: false,
		autoloadTsconfig: false,
		autoloadPackageJson: false,
	});
});
