import { expect, test } from "bun:test";
import { expandFileTemplate } from "./fileTemplate";

const at = new Date("2026-09-07T11:42:33.456Z");

test("{timestamp} becomes a filesystem-safe ISO timestamp", () => {
	expect(expandFileTemplate("model_{timestamp}", at)).toBe(
		"model_2026-09-07T11-42-33",
	);
});

test("the expanded timestamp carries no character that a path forbids", () => {
	const expanded = expandFileTemplate("{timestamp}", at);
	expect(expanded).not.toMatch(/[:.\\/]/);
});

test("directories and the extension around the placeholder survive", () => {
	expect(expandFileTemplate("./out/results_{timestamp}.csv", at)).toBe(
		"./out/results_2026-09-07T11-42-33.csv",
	);
});

test("every occurrence of the placeholder is replaced", () => {
	expect(expandFileTemplate("{timestamp}/run_{timestamp}.txt", at)).toBe(
		"2026-09-07T11-42-33/run_2026-09-07T11-42-33.txt",
	);
});

test("a template without a placeholder is returned unchanged", () => {
	expect(expandFileTemplate("./output.txt", at)).toBe("./output.txt");
});

test("the timestamp defaults to the current time", () => {
	const before = expandFileTemplate("{timestamp}");
	expect(before).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
});
