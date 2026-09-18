import { expect, test } from "bun:test";
import { isTextInputActive } from "./textInput";

test("no text input is active on plain panels and non-text fields", () => {
	expect(isTextInputActive(0, "params", "none")).toBe(false);
	expect(isTextInputActive(0, "submodels", "none")).toBe(false);
	expect(isTextInputActive(1, "params", "format")).toBe(false);
	expect(isTextInputActive(1, "params", "randomize")).toBe(false);
	expect(isTextInputActive(2, "params", "none")).toBe(false);
});

test("every model-tab editing panel counts on the model tab", () => {
	expect(isTextInputActive(0, "adding", "none")).toBe(true);
	expect(isTextInputActive(0, "values", "none")).toBe(true);
	expect(isTextInputActive(0, "constraints", "none")).toBe(true);
	expect(isTextInputActive(0, "submodel-adding", "none")).toBe(true);
});

test("every options-tab text field counts on the options tab", () => {
	expect(isTextInputActive(1, "params", "filepath")).toBe(true);
	expect(isTextInputActive(1, "params", "order")).toBe(true);
	expect(isTextInputActive(1, "params", "storagePath")).toBe(true);
	expect(isTextInputActive(1, "params", "fileTemplate")).toBe(true);
});

test("a panel or field belonging to another tab has no input on screen", () => {
	expect(isTextInputActive(2, "adding", "none")).toBe(false);
	expect(isTextInputActive(1, "values", "none")).toBe(false);
	expect(isTextInputActive(0, "params", "filepath")).toBe(false);
	expect(isTextInputActive(2, "params", "filepath")).toBe(false);
});
