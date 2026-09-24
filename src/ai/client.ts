import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_AI_MODEL } from "../constants";
import type { AiModel, Parameter, Submodel } from "../types";

const SYSTEM_PROMPT = `You are a PICT (Pairwise Independent Combinatorial Testing) model generator.
Given a description of a software feature or test scenario, identify the key test parameters and their possible values, and optionally generate PICT constraints when logical dependencies exist between parameters.

Each parameter represents a distinct test dimension (e.g., browser, OS, role, input type).
Values should be concrete, discrete options for that parameter.
Keep parameters focused and relevant — typically 3–8 parameters with 2–6 values each.

PICT model file format:
  Parameters are declared as: ParameterName: Value1, Value2, Value3
  Sections must appear in this order: parameters first, then sub-models (if any), then constraints.
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

Sub-models (use sparingly, only when a parameter group clearly needs deeper coverage):
  {"paramNames": ["Param1", "Param2"], "order": 3}
  order = combination order (2 = pairwise, 3 = three-way, etc.)
  Example: { Platform, Browser } @ 3 means all 3-way combinations of Platform and Browser
  Only generate sub-models when there is a strong reason for N-way coverage of a specific group.

Respond with JSON matching the provided schema. Each constraint is one PICT constraint string ending with a semicolon.
Use empty arrays for "submodels" and "constraints" when none are needed.`;

// The API enforces this shape (structured outputs), so the response text is
// always parseable JSON. Numeric and string limits (order >= 1, non-empty
// names) are not expressible here and are still checked after parsing.
const MODEL_SCHEMA = {
	type: "object",
	properties: {
		parameters: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					values: { type: "array", items: { type: "string" } },
				},
				required: ["name", "values"],
				additionalProperties: false,
			},
		},
		submodels: {
			type: "array",
			items: {
				type: "object",
				properties: {
					paramNames: { type: "array", items: { type: "string" } },
					order: { type: "integer" },
				},
				required: ["paramNames", "order"],
				additionalProperties: false,
			},
		},
		constraints: { type: "array", items: { type: "string" } },
	},
	required: ["parameters", "submodels", "constraints"],
	additionalProperties: false,
};

// Every supported model runs adaptive thinking (always on for Opus 5.5 and
// Fable 5.1, which reject disabling it, so no `thinking` field is sent), and
// thinking tokens count toward max_tokens. The request is streamed because
// the SDK refuses non-streaming requests above ~21k max_tokens; 64k leaves
// ample room for thinking plus the JSON while staying well below the 128k
// every supported model allows. Only tokens actually generated are billed.
const MAX_TOKENS = 64000;

/** The slice of the Anthropic client used here, injectable for tests. */
export interface AiClient {
	messages: {
		stream(params: Anthropic.MessageStreamParams): {
			finalMessage(): Promise<Anthropic.Message>;
		};
	};
}

export async function generateModel(
	prompt: string,
	apiKey: string,
	model: AiModel = DEFAULT_AI_MODEL,
	client: AiClient = new Anthropic({ apiKey }),
): Promise<{
	parameters: Parameter[];
	submodels: Submodel[];
	constraints: string;
}> {
	const message = await client.messages
		.stream({
			model,
			max_tokens: MAX_TOKENS,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: prompt }],
			output_config: { format: { type: "json_schema", schema: MODEL_SCHEMA } },
		})
		.finalMessage();

	if (message.stop_reason === "refusal") {
		throw new Error("Claude declined to respond to this request");
	}
	if (message.stop_reason === "max_tokens") {
		throw new Error(
			"Claude ran out of output space before finishing the model. Try a shorter, more focused description.",
		);
	}

	// Find the first text block rather than assuming it is at index 0. All
	// supported models think, so a response can start with `thinking` blocks
	// and content[0] is not guaranteed to be the text response.
	let textContent: string | undefined;
	for (const block of message.content) {
		if (block.type === "text") {
			textContent = block.text;
			break;
		}
	}
	if (textContent === undefined) {
		throw new Error("Unexpected response format from Claude API");
	}

	let parsed: {
		parameters: Array<{ name: string; values: string[] }>;
		submodels?: Array<{ paramNames: string[]; order: number }>;
		constraints?: string[];
	};
	try {
		parsed = JSON.parse(textContent);
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

	const submodels: Submodel[] = Array.isArray(parsed.submodels)
		? parsed.submodels
				.filter(
					(s) =>
						Array.isArray(s?.paramNames) &&
						typeof s?.order === "number" &&
						s.order >= 1,
				)
				.map((s) => ({
					paramNames: s.paramNames
						.map((n) => String(n).trim())
						.filter((n) => n.length > 0),
					order: Math.max(1, Math.floor(s.order)),
				}))
				.filter((s) => s.paramNames.length > 0)
		: [];

	const constraints = Array.isArray(parsed.constraints)
		? parsed.constraints
				.map((c) => String(c).trim())
				.filter((c) => c.length > 0)
				.join("\n")
		: "";

	return { parameters, submodels, constraints };
}
