import { expect, test } from "bun:test";
import { AI_MODELS, DEFAULT_AI_MODEL, nextOptionField } from "./constants";
import { AI_MODEL_LABELS } from "./types";

test("Tab moves to the next options field and wraps to the first", () => {
	expect(nextOptionField("filepath")).toBe("format");
	expect(nextOptionField("none")).toBe("filepath");
});

test("the selectable AI models are Haiku, Sonnet, Opus 5.5 and Fable 5.2, in that order", () => {
	expect(AI_MODELS).toEqual([
		"claude-haiku-5-5",
		"claude-sonnet-5-5",
		"claude-opus-5-5",
		"claude-fable-5-2",
	]);
});

test("every selectable AI model has a display label", () => {
	expect(AI_MODEL_LABELS["claude-fable-5-2"]).toBe("Fable 5.2");
	for (const model of AI_MODELS) {
		expect(AI_MODEL_LABELS[model]).toBeTruthy();
	}
});

test("the default AI model stays Sonnet 5.5", () => {
	expect(DEFAULT_AI_MODEL).toBe("claude-sonnet-5-5");
});
