import { expect, test } from "bun:test";
import { type OverlayFlags, resolveActiveOverlay } from "./overlay";

const NONE: OverlayFlags = {
	logOpen: false,
	docsOpen: false,
	pickerOpen: false,
	aiSetupOpen: false,
	aiPromptOpen: false,
	showClearConfirm: false,
	generateSaveOpen: false,
};

test("no overlay flag set resolves to null (tabs are shown)", () => {
	expect(resolveActiveOverlay(NONE)).toBeNull();
});

test("each flag alone resolves to its own overlay kind", () => {
	expect(resolveActiveOverlay({ ...NONE, logOpen: true })).toBe("log");
	expect(resolveActiveOverlay({ ...NONE, docsOpen: true })).toBe("docs");
	expect(resolveActiveOverlay({ ...NONE, pickerOpen: true })).toBe("picker");
	expect(resolveActiveOverlay({ ...NONE, aiSetupOpen: true })).toBe("aiSetup");
	expect(resolveActiveOverlay({ ...NONE, aiPromptOpen: true })).toBe(
		"aiPrompt",
	);
	expect(resolveActiveOverlay({ ...NONE, showClearConfirm: true })).toBe(
		"clearConfirm",
	);
	expect(resolveActiveOverlay({ ...NONE, generateSaveOpen: true })).toBe(
		"generateSave",
	);
});

test("precedence: log beats every other overlay", () => {
	expect(
		resolveActiveOverlay({
			...NONE,
			logOpen: true,
			docsOpen: true,
			pickerOpen: true,
			aiSetupOpen: true,
			aiPromptOpen: true,
			showClearConfirm: true,
			generateSaveOpen: true,
		}),
	).toBe("log");
});

test("precedence: docs beats picker, aiSetup, aiPrompt, clearConfirm, generateSave", () => {
	expect(
		resolveActiveOverlay({
			...NONE,
			docsOpen: true,
			pickerOpen: true,
			aiSetupOpen: true,
			aiPromptOpen: true,
			showClearConfirm: true,
			generateSaveOpen: true,
		}),
	).toBe("docs");
});

test("precedence: picker beats aiSetup, aiPrompt, clearConfirm, generateSave", () => {
	expect(
		resolveActiveOverlay({
			...NONE,
			pickerOpen: true,
			aiSetupOpen: true,
			aiPromptOpen: true,
			showClearConfirm: true,
			generateSaveOpen: true,
		}),
	).toBe("picker");
});

test("precedence: aiSetup beats aiPrompt, clearConfirm, generateSave", () => {
	expect(
		resolveActiveOverlay({
			...NONE,
			aiSetupOpen: true,
			aiPromptOpen: true,
			showClearConfirm: true,
			generateSaveOpen: true,
		}),
	).toBe("aiSetup");
});

test("precedence: aiPrompt beats clearConfirm, generateSave", () => {
	expect(
		resolveActiveOverlay({
			...NONE,
			aiPromptOpen: true,
			showClearConfirm: true,
			generateSaveOpen: true,
		}),
	).toBe("aiPrompt");
});

test("precedence: clearConfirm beats generateSave", () => {
	expect(
		resolveActiveOverlay({
			...NONE,
			showClearConfirm: true,
			generateSaveOpen: true,
		}),
	).toBe("clearConfirm");
});
