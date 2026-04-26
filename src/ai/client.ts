import Anthropic from "@anthropic-ai/sdk";
import type { AiModel, Parameter } from "../types";

const SYSTEM_PROMPT = `You are a PICT (Pairwise Independent Combinatorial Testing) model generator.
Given a description of a software feature or test scenario, identify the key test parameters and their possible values, and optionally generate PICT constraints when logical dependencies exist between parameters.

Each parameter represents a distinct test dimension (e.g., browser, OS, role, input type).
Values should be concrete, discrete options for that parameter.
Keep parameters focused and relevant — typically 3–8 parameters with 2–6 values each.

PICT model file format:
  Parameters are declared as: ParameterName: Value1, Value2, Value3
  Sections must appear in this order: parameters first, then constraints.
  Example:
    Browser: Chrome, Firefox, Edge
    OS:      Windows, macOS, Linux

    IF [OS] = "Linux" THEN [Browser] <> "Edge";

Advanced value syntax:
  Aliases — two names for the same logical value, rotating in output:
    SKU: Professional, Server | Datacenter
  Negative / out-of-range values — prefixed with ~, never paired with another negative:
    Size: ~-1, 0, 1, 100
  Weighted values — bias toward a value (hint, not a guarantee):
    Type: Primary (10), Logical, Single
  Dummy NA values — for parameters irrelevant under certain conditions:
    DotNetVersion: 4.8, 4.8.1, NA
    Pair with: IF [OS] = "Linux" THEN [DotNetVersion] = "NA" ELSE [DotNetVersion] <> "NA";

PICT constraint syntax (use ONLY when meaningful dependencies exist):
  Conditional with optional ELSE:
    IF [ParamName] = "value" THEN [OtherParam] <> "otherValue";
    IF [P] IN {"v1", "v2"} THEN [Q] = "v";
    IF [P] = "v" AND [Q] = "w" THEN [R] = "x";
    IF [P] = "v" THEN [Q] = "w" ELSE [Q] = "x";
  Unconditional invariants:
    [OS_1] <> [OS_2] OR [SKU_1] <> [SKU_2];
  Cross-parameter comparison:
    [Param1] = [Param2];
Rules:
  - Parameter names must be wrapped in square brackets: [Name]
  - Values must be wrapped in double quotes: "value"
  - Operators: =, <>, >, <, >=, <=, IN {"v1","v2"}, LIKE "pattern"
  - Logical connectors: AND, OR, NOT, parentheses
  - Each constraint must end with a semicolon ;
  - Type system: if all values of a parameter are numeric they support numeric comparisons; otherwise string comparisons apply (case-insensitive by default)
  - Only generate constraints when they reflect real-world impossibilities or strong dependencies

Respond ONLY with valid JSON in this exact format, no additional text:
{"parameters": [{"name": "ParameterName", "values": ["value1", "value2", "value3"]}], "constraints": ["IF [P] = \\"v1\\" THEN [Q] <> \\"v2\\";"]}
The "constraints" field is optional — omit it or use an empty array if no constraints are needed.`;

export async function generateModel(
	prompt: string,
	apiKey: string,
	model: AiModel = "claude-haiku-4-5",
): Promise<{ parameters: Parameter[]; constraints: string }> {
	const client = new Anthropic({ apiKey });

	const message = await client.messages.create({
		model,
		max_tokens: 2048,
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: prompt }],
	});

	const firstContent = message.content[0];
	if (!firstContent || firstContent.type !== "text") {
		throw new Error("Unexpected response format from Claude API");
	}

	let parsed: {
		parameters: Array<{ name: string; values: string[] }>;
		constraints?: string[];
	};
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

	const parameters = parsed.parameters
		.map((p) => ({
			name: String(p.name ?? "").trim(),
			values: Array.isArray(p.values)
				? p.values.map((v) => String(v).trim()).filter((v) => v.length > 0)
				: [],
		}))
		.filter((p) => p.name.length > 0);

	const constraints = Array.isArray(parsed.constraints)
		? parsed.constraints
				.map((c) => String(c).trim())
				.filter((c) => c.length > 0)
				.join("\n")
		: "";

	return { parameters, constraints };
}
