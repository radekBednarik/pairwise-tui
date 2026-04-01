import { useEffect, useState } from "react";
import { loadApiKey } from "../ai/credentials";
import type { AiModel } from "../types";

export interface AiState {
	apiKey: string | null;
	aiModel: AiModel;
	setApiKey: (key: string | null) => void;
	setAiModel: (model: AiModel) => void;
}

export function useAiState(initialAiModel: AiModel): AiState {
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [aiModel, setAiModel] = useState<AiModel>(initialAiModel);

	useEffect(() => {
		loadApiKey().then(setApiKey);
	}, []);

	return { apiKey, aiModel, setApiKey, setAiModel };
}
