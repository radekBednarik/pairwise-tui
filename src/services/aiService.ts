import { generateModel } from "../ai/client";
import { clearApiKey, saveApiKey } from "../ai/credentials";
import type { AiModel, Parameter } from "../types";

export async function configureApiKey(apiKey: string): Promise<void> {
	await saveApiKey(apiKey);
}

export async function removeApiKey(): Promise<void> {
	await clearApiKey();
}

export async function generateModelFromPrompt(
	prompt: string,
	apiKey: string,
	model: AiModel,
): Promise<{ parameters: Parameter[]; constraints: string }> {
	return generateModel(prompt, apiKey, model);
}
