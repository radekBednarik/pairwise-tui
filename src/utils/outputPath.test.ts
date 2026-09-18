import { expect, test } from "bun:test";
import { FORMAT_EXTENSIONS } from "../output/writer";
import { formatFromExtension, withExtension } from "./outputPath";

test("a known typed extension maps back to its format", () => {
	expect(formatFromExtension("out/cases.json", FORMAT_EXTENSIONS)).toBe("json");
	expect(formatFromExtension("cases.csv", FORMAT_EXTENSIONS)).toBe("csv");
	expect(formatFromExtension("cases.md", FORMAT_EXTENSIONS)).toBe("md");
});

test("extension matching ignores case", () => {
	expect(formatFromExtension("CASES.JSON", FORMAT_EXTENSIONS)).toBe("json");
});

test("an unknown extension resolves to null", () => {
	expect(formatFromExtension("cases.foo", FORMAT_EXTENSIONS)).toBeNull();
});

test("a path without an extension resolves to null", () => {
	expect(
		formatFromExtension("cases_{timestamp}", FORMAT_EXTENSIONS),
	).toBeNull();
});

test("a dot inside a directory is not an extension", () => {
	expect(formatFromExtension("out.d/cases", FORMAT_EXTENSIONS)).toBeNull();
	expect(formatFromExtension("out.d\\cases", FORMAT_EXTENSIONS)).toBeNull();
});

test("a dotfile name is not an extension", () => {
	expect(formatFromExtension(".json", FORMAT_EXTENSIONS)).toBeNull();
});

test("cycling the format on a dotfile-style name keeps the name and appends", () => {
	// Mirrors formatFromExtension: a leading dot is a name, not an extension.
	expect(withExtension("out/.env", ".json")).toBe("out/.env.json");
	expect(withExtension(".json", ".csv")).toBe(".json.csv");
});

test("cycling the format replaces a real extension after a dotfile prefix", () => {
	expect(withExtension("out/.env.txt", ".json")).toBe("out/.env.json");
});
