import { expect, test } from "bun:test";
import type Anthropic from "@anthropic-ai/sdk";
import { type AiClient, generateModel } from "./client";

const MODEL_JSON = JSON.stringify({
	parameters: [
		{ name: " Browser ", values: ["Chrome", " Firefox ", ""] },
		{ name: "", values: ["x"] },
	],
	submodels: [{ paramNames: ["Browser"], order: 2 }],
	constraints: ['IF [Browser] = "Chrome" THEN [Browser] <> "Firefox";'],
});

function fakeClient(
	message: Partial<Anthropic.Message>,
	captured: Anthropic.MessageStreamParams[] = [],
): AiClient {
	return {
		messages: {
			stream(params) {
				captured.push(params);
				return {
					finalMessage: async () =>
						({
							stop_reason: "end_turn",
							content: [],
							...message,
						}) as unknown as Anthropic.Message,
				};
			},
		},
	};
}

const text = (t: string) => ({ type: "text", text: t, citations: null });
const thinking = { type: "thinking", thinking: "", signature: "sig" };

test("streams the request with room for thinking and a JSON schema format", async () => {
	const captured: Anthropic.MessageStreamParams[] = [];
	const client = fakeClient(
		{ content: [text(MODEL_JSON)] as Anthropic.ContentBlock[] },
		captured,
	);
	await generateModel("login form", "key", "claude-fable-5-1", client);

	const params = captured[0];
	expect(params?.model).toBe("claude-fable-5-1");
	expect(params?.max_tokens).toBe(64000);
	expect(params?.output_config?.format?.type).toBe("json_schema");
	expect(params?.thinking).toBeUndefined();
	expect(params?.messages).toEqual([{ role: "user", content: "login form" }]);
});

test("reads the text block that follows leading thinking blocks", async () => {
	const client = fakeClient({
		content: [thinking, thinking, text(MODEL_JSON)] as Anthropic.ContentBlock[],
	});
	const result = await generateModel("x", "key", "claude-sonnet-5", client);

	expect(result.parameters).toEqual([
		{ name: "Browser", values: ["Chrome", "Firefox"] },
	]);
	expect(result.submodels).toEqual([{ paramNames: ["Browser"], order: 2 }]);
	expect(result.constraints).toBe(
		'IF [Browser] = "Chrome" THEN [Browser] <> "Firefox";',
	);
});

test("a refusal is reported as an error", async () => {
	const client = fakeClient({ stop_reason: "refusal" });
	await expect(
		generateModel("x", "key", "claude-sonnet-5", client),
	).rejects.toThrow("declined");
});

test("hitting max_tokens tells the user how to recover", async () => {
	const client = fakeClient({
		stop_reason: "max_tokens",
		content: [thinking] as Anthropic.ContentBlock[],
	});
	await expect(
		generateModel("x", "key", "claude-sonnet-5", client),
	).rejects.toThrow("shorter, more focused description");
});

test("a response without a text block is rejected", async () => {
	const client = fakeClient({
		content: [thinking] as Anthropic.ContentBlock[],
	});
	await expect(
		generateModel("x", "key", "claude-sonnet-5", client),
	).rejects.toThrow("Unexpected response format");
});

test("text that is not valid JSON is rejected", async () => {
	const client = fakeClient({
		content: [text("not json")] as Anthropic.ContentBlock[],
	});
	await expect(
		generateModel("x", "key", "claude-sonnet-5", client),
	).rejects.toThrow("Failed to parse Claude response");
});
