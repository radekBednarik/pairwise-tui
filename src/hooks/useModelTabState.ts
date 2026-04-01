import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivePanel } from "../constants";
import type { PictModel } from "../types";

export interface ModelTabState {
	activePanel: ActivePanel;
	selectedParamIndex: number;
	newParamName: string;
	valuesInput: string;
	constraintsKey: number;
	setActivePanel: (panel: ActivePanel) => void;
	setSelectedParamIndex: Dispatch<SetStateAction<number>>;
	setValuesInput: (v: string) => void;
	setConstraintsKey: Dispatch<SetStateAction<number>>;
	handleParamNavigate: (index: number) => void;
	handleValuesChange: (value: string) => void;
	handleNewParamNameChange: (name: string) => void;
	handleConfirmAddParam: () => void;
	handleDeleteParam: () => void;
	cancelAddParam: () => void;
}

export function useModelTabState(
	model: PictModel,
	setModel: Dispatch<SetStateAction<PictModel>>,
): ModelTabState {
	const [activePanel, setActivePanel] = useState<ActivePanel>("params");
	const [selectedParamIndex, setSelectedParamIndex] = useState(0);
	const [newParamName, setNewParamName] = useState("");
	const newParamNameRef = useRef("");
	const [valuesInput, setValuesInput] = useState("");
	const [constraintsKey, setConstraintsKey] = useState(0);

	// Sync valuesInput when selected param changes (intentionally omits model.parameters
	// to avoid overwriting the user's input on every keystroke)
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional omission
	useEffect(() => {
		const param = model.parameters[selectedParamIndex];
		setValuesInput(param ? param.values.join(", ") : "");
	}, [selectedParamIndex]);

	const handleParamNavigate = useCallback((index: number) => {
		setSelectedParamIndex(index);
	}, []);

	const handleValuesChange = useCallback(
		(value: string) => {
			setValuesInput(value);
			const parts = value
				.split(",")
				.map((v) => v.trim())
				.filter((v) => v.length > 0);
			setModel((m) => ({
				...m,
				parameters: m.parameters.map((p, i) =>
					i === selectedParamIndex ? { ...p, values: parts } : p,
				),
			}));
		},
		[selectedParamIndex, setModel],
	);

	const handleNewParamNameChange = useCallback((name: string) => {
		newParamNameRef.current = name;
		setNewParamName(name);
	}, []);

	const handleConfirmAddParam = useCallback(() => {
		const name = newParamNameRef.current.trim();
		if (!name) return;
		newParamNameRef.current = "";
		setModel((m) => {
			const newParams = [...m.parameters, { name, values: [] }];
			setSelectedParamIndex(newParams.length - 1);
			setValuesInput("");
			return { ...m, parameters: newParams };
		});
		setNewParamName("");
		setActivePanel("params");
	}, [setModel]);

	const handleDeleteParam = useCallback(() => {
		setModel((m) => {
			if (m.parameters.length === 0) return m;
			return {
				...m,
				parameters: m.parameters.filter((_, i) => i !== selectedParamIndex),
			};
		});
		setSelectedParamIndex((i) => Math.max(0, i - 1));
	}, [selectedParamIndex, setModel]);

	const cancelAddParam = useCallback(() => {
		newParamNameRef.current = "";
		setNewParamName("");
		setActivePanel("params");
	}, []);

	return {
		activePanel,
		selectedParamIndex,
		newParamName,
		valuesInput,
		constraintsKey,
		setActivePanel,
		setSelectedParamIndex,
		setValuesInput,
		setConstraintsKey,
		handleParamNavigate,
		handleValuesChange,
		handleNewParamNameChange,
		handleConfirmAddParam,
		handleDeleteParam,
		cancelAddParam,
	};
}
