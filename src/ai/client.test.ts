import { afterEach, expect, test } from "bun:test";
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
	await generateModel("login form", "key", "claude-fable-5-2", client);

	const params = captured[0];
	expect(params?.model).toBe("claude-fable-5-2");
	expect(params?.max_tokens).toBe(64000);
	expect(params?.output_config?.format?.type).toBe("json_schema");
	expect(params?.output_config?.effort).toBe("high");
	expect(params?.thinking).toBeUndefined();
	expect(params?.messages).toEqual([{ role: "user", content: "login form" }]);
});

test("haiku gets the same pinned effort and no thinking field", async () => {
	const captured: Anthropic.MessageStreamParams[] = [];
	const client = fakeClient(
		{ content: [text(MODEL_JSON)] as Anthropic.ContentBlock[] },
		captured,
	);
	await generateModel("login form", "key", "claude-haiku-5-5", client);

	const params = captured[0];
	expect(params?.model).toBe("claude-haiku-5-5");
	expect(params?.output_config?.effort).toBe("high");
	expect(params?.thinking).toBeUndefined();
});

test("reads the text block that follows leading thinking blocks", async () => {
	const client = fakeClient({
		content: [thinking, thinking, text(MODEL_JSON)] as Anthropic.ContentBlock[],
	});
	const result = await generateModel("x", "key", "claude-sonnet-5-5", client);

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
		generateModel("x", "key", "claude-sonnet-5-5", client),
	).rejects.toThrow("declined");
});

test("hitting max_tokens tells the user how to recover", async () => {
	const client = fakeClient({
		stop_reason: "max_tokens",
		content: [thinking] as Anthropic.ContentBlock[],
	});
	await expect(
		generateModel("x", "key", "claude-sonnet-5-5", client),
	).rejects.toThrow("shorter, more focused description");
});

test("a response without a text block is rejected", async () => {
	const client = fakeClient({
		content: [thinking] as Anthropic.ContentBlock[],
	});
	await expect(
		generateModel("x", "key", "claude-sonnet-5-5", client),
	).rejects.toThrow("Unexpected response format");
});

test("text that is not valid JSON is rejected", async () => {
	const client = fakeClient({
		content: [text("not json")] as Anthropic.ContentBlock[],
	});
	await expect(
		generateModel("x", "key", "claude-sonnet-5-5", client),
	).rejects.toThrow("Failed to parse Claude response");
});

// The tests above inject a fake client, so they never exercise the real SDK.
// This one swaps out the global fetch instead, so the default
// `new Anthropic({ apiKey })` path runs for real and we can check what it puts
// on the wire, with no network access and no real key. The stub answers 401.
// Only the first request is checked, so the test doesn't depend on whether
// the SDK retries that status.
const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

test("the default client sends the 2026-10-21 API version and a bearer key", async () => {
	const requests: { url: string; headers: Headers; body: string }[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		requests.push({
			url: request.url,
			headers: request.headers,
			body: await request.text(),
		});
		return new Response(
			JSON.stringify({
				type: "error",
				error: { type: "authentication_error", message: "stub" },
			}),
			{ status: 401, headers: { "content-type": "application/json" } },
		);
	}) as typeof fetch;

	await expect(generateModel("login form", "test-key")).rejects.toThrow();

	expect(requests.length).toBeGreaterThanOrEqual(1);
	const [request] = requests;
	expect(request?.url).toEndWith("/v1/messages");
	expect(request?.headers.get("anthropic-version")).toBe("2026-10-21");
	expect(request?.headers.get("authorization")).toBe("Bearer test-key");
	expect(request?.headers.get("x-api-key")).toBeNull();

	const body = JSON.parse(request?.body ?? "{}");
	expect(body.model).toBe("claude-sonnet-5-5");
	expect(body.max_tokens).toBe(64000);
	expect(body.stream).toBe(true);
	expect(body.output_config.effort).toBe("high");
	for (const removed of ["thinking", "temperature", "top_p", "top_k"]) {
		expect(body).not.toHaveProperty(removed);
	}
});
