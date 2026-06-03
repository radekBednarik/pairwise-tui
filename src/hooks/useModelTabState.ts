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
	selectedSubmodelIndex: number;
	submodelAddingStep: "params" | "order";
	submodelParamsInput: string;
	submodelOrderInput: string;
	submodelDropdownFocused: boolean;
	submodelDropdownOptions: Array<{ name: string; description: string }>;
	submodelValidationError: string | null;
	setSelectedSubmodelIndex: Dispatch<SetStateAction<number>>;
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
	startAddSubmodel: () => void;
	cancelAddSubmodel: () => void;
	handleSubmodelNavigate: (index: number) => void;
	handleSubmodelParamsInputChange: (value: string) => void;
	handleSubmodelOrderInputChange: (value: string) => void;
	handleConfirmSubmodelParams: () => void;
	handleConfirmSubmodelOrder: () => void;
	handleDeleteSubmodel: () => void;
	handleConstraintsChange: (value: string) => void;
	handleSubmodelDropdownFocus: () => void;
	handleSubmodelDropdownSelect: (paramName: string) => void;
	cancelSubmodelDropdown: () => void;
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
	const [selectedSubmodelIndex, setSelectedSubmodelIndex] = useState(0);
	const [submodelAddingStep, setSubmodelAddingStep] = useState<
		"params" | "order"
	>("params");
	const [submodelParamsInput, setSubmodelParamsInput] = useState("");
	const [submodelOrderInput, setSubmodelOrderInput] = useState("2");
	const submodelPartsRef = useRef<string[]>([]);
	const submodelParamsInputRef = useRef<string>("");
	const submodelOrderInputRef = useRef<string>("2");
	const [submodelDropdownFocused, setSubmodelDropdownFocused] = useState(false);
	const [submodelValidationError, setSubmodelValidationError] = useState<
		string | null
	>(null);

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

	const startAddSubmodel = useCallback(() => {
		submodelPartsRef.current = [];
		submodelParamsInputRef.current = "";
		submodelOrderInputRef.current = "2";
		setSubmodelParamsInput("");
		setSubmodelOrderInput("2");
		setSubmodelAddingStep("params");
		setSubmodelDropdownFocused(false);
		setSubmodelValidationError(null);
		setActivePanel("submodel-adding");
	}, []);

	const cancelAddSubmodel = useCallback(() => {
		submodelPartsRef.current = [];
		submodelParamsInputRef.current = "";
		submodelOrderInputRef.current = "2";
		setSubmodelParamsInput("");
		setSubmodelOrderInput("2");
		setSubmodelAddingStep("params");
		setSubmodelDropdownFocused(false);
		setSubmodelValidationError(null);
		setActivePanel("submodels");
	}, []);

	const handleSubmodelNavigate = useCallback((index: number) => {
		setSelectedSubmodelIndex(index);
	}, []);

	const handleSubmodelParamsInputChange = useCallback(
		(value: string) => {
			submodelParamsInputRef.current = value;
			setSubmodelParamsInput(value);

			// Validate all completed tokens (everything before the last comma)
			const parts = value.split(",");
			const completed = parts
				.slice(0, -1)
				.map((s) => s.trim())
				.filter((s) => s.length > 0);

			if (completed.length > 0) {
				const paramNameMap = new Map(
					model.parameters.map((p) => [p.name.toLowerCase(), p.name]),
				);
				const invalid = completed.filter(
					(t) => !paramNameMap.has(t.toLowerCase()),
				);
				setSubmodelValidationError(
					invalid.length > 0 ? `Unknown: ${invalid.join(", ")}` : null,
				);
			} else {
				setSubmodelValidationError(null);
			}
		},
		[model.parameters],
	);

	const handleSubmodelOrderInputChange = useCallback((value: string) => {
		submodelOrderInputRef.current = value;
		setSubmodelOrderInput(value);
	}, []);

	const handleConfirmSubmodelParams = useCallback(() => {
		const paramNameMap = new Map(
			model.parameters.map((p) => [p.name.toLowerCase(), p.name]),
		);
		const allTokens = submodelParamsInputRef.current
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		if (allTokens.length === 0) return;

		// Block if any token is invalid
		const invalid = allTokens.filter((t) => !paramNameMap.has(t.toLowerCase()));
		if (invalid.length > 0) {
			setSubmodelValidationError(`Unknown: ${invalid.join(", ")}`);
			return;
		}

		// Normalize to canonical casing
		const parts = allTokens.map((s) => paramNameMap.get(s.toLowerCase()) ?? s);

		submodelParamsInputRef.current = "";
		submodelPartsRef.current = parts;
		setSubmodelAddingStep("order");
	}, [model.parameters]);

	const handleConfirmSubmodelOrder = useCallback(() => {
		const parts = submodelPartsRef.current;
		if (parts.length === 0) return;
		const parsed = Number.parseInt(submodelOrderInputRef.current, 10);
		if (Number.isNaN(parsed)) return;
		const order = Math.max(1, parsed);
		setModel((m) => {
			const newSubmodels = [...m.submodels, { paramNames: parts, order }];
			setSelectedSubmodelIndex(newSubmodels.length - 1);
			return { ...m, submodels: newSubmodels };
		});
		submodelPartsRef.current = [];
		submodelParamsInputRef.current = "";
		submodelOrderInputRef.current = "2";
		setSubmodelParamsInput("");
		setSubmodelOrderInput("2");
		setSubmodelAddingStep("params");
		setActivePanel("submodels");
	}, [setModel]);

	const handleDeleteSubmodel = useCallback(() => {
		setModel((m) => {
			if (m.submodels.length === 0) return m;
			return {
				...m,
				submodels: m.submodels.filter((_, i) => i !== selectedSubmodelIndex),
			};
		});
		setSelectedSubmodelIndex((i) => Math.max(0, i - 1));
	}, [selectedSubmodelIndex, setModel]);

	const handleConstraintsChange = useCallback(
		(value: string) => {
			setModel((m) => ({ ...m, constraints: value }));
		},
		[setModel],
	);

	const handleSubmodelDropdownFocus = useCallback(() => {
		setSubmodelDropdownFocused(true);
	}, []);

	const handleSubmodelDropdownSelect = useCallback((paramName: string) => {
		const parts = submodelParamsInputRef.current.split(",");
		// First token: no leading space; subsequent tokens: space after comma
		if (parts.length === 1) {
			parts[0] = paramName;
		} else {
			parts[parts.length - 1] = ` ${paramName}`;
		}
		const newValue = `${parts.join(",")}, `;
		submodelParamsInputRef.current = newValue;
		setSubmodelParamsInput(newValue);
		setSubmodelDropdownFocused(false);
		setSubmodelValidationError(null);
	}, []);

	const cancelSubmodelDropdown = useCallback(() => {
		setSubmodelDropdownFocused(false);
	}, []);

	// Compute dropdown options from current input state and model params
	const _inputParts = submodelParamsInput.split(",");
	const _currentToken = (_inputParts.at(-1) ?? "").trim();
	const _completedLower = new Set(
		_inputParts
			.slice(0, -1)
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
			.map((s) => s.toLowerCase()),
	);
	const submodelDropdownOptions = model.parameters
		.map((p) => p.name)
		.filter((n) => !_completedLower.has(n.toLowerCase()))
		.filter((n) => n.toLowerCase().includes(_currentToken.toLowerCase()))
		.map((n) => ({ name: n, description: "" }));

	return {
		activePanel,
		selectedParamIndex,
		newParamName,
		valuesInput,
		constraintsKey,
		selectedSubmodelIndex,
		submodelAddingStep,
		submodelParamsInput,
		submodelOrderInput,
		submodelDropdownFocused,
		submodelDropdownOptions,
		submodelValidationError,
		setSelectedSubmodelIndex,
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
		startAddSubmodel,
		cancelAddSubmodel,
		handleSubmodelNavigate,
		handleSubmodelParamsInputChange,
		handleSubmodelOrderInputChange,
		handleConfirmSubmodelParams,
		handleConfirmSubmodelOrder,
		handleDeleteSubmodel,
		handleConstraintsChange,
		handleSubmodelDropdownFocus,
		handleSubmodelDropdownSelect,
		cancelSubmodelDropdown,
	};
}
