import Anthropic from "@anthropic-ai/sdk";
import type { Parameter } from "../types";

const SYSTEM_PROMPT = `You are a PICT (Pairwise Independent Combinatorial Testing) parameter extractor.
Given a description of a software feature or test scenario, identify the key test parameters and their possible values.
Each parameter represents a distinct test dimension (e.g., browser, OS, role, input type).
Values should be concrete, discrete options for that parameter.
Keep parameters focused and relevant — typically 3–8 parameters with 2–6 values each.
Respond ONLY with valid JSON in this exact format, no additional text:
{"parameters": [{"name": "ParameterName", "values": ["value1", "value2", "value3"]}]}`;

export async function generateParameters(
	prompt: string,
	apiKey: string,
): Promise<Parameter[]> {
	const client = new Anthropic({ apiKey });

	const message = await client.messages.create({
		model: "claude-haiku-4-5-20251001",
		max_tokens: 1024,
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: prompt }],
	});

	const firstContent = message.content[0];
	if (!firstContent || firstContent.type !== "text") {
		throw new Error("Unexpected response format from Claude API");
	}

	let parsed: { parameters: Array<{ name: string; values: string[] }> };
	try {
		const text = firstContent.text.trim();
		// Claude may wrap JSON in markdown code blocks
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error("No JSON found in response");
		parsed = JSON.parse(jsonMatch[0]);
	} catch (err) {
		throw new Error(
			`Failed to parse Claude response: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	if (!Array.isArray(parsed?.parameters)) {
		throw new Error("Invalid response: missing parameters array");
	}

	return parsed.parameters
		.map((p) => ({
			name: String(p.name ?? "").trim(),
			values: Array.isArray(p.values)
				? p.values.map((v) => String(v).trim()).filter((v) => v.length > 0)
				: [],
		}))
		.filter((p) => p.name.length > 0);
}
