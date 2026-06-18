import type { RefObject } from "react";
import { useEffect } from "react";
import type { ActivePanel } from "../constants";
import {
	applyPictHighlights,
	getPictSyntaxStyle,
} from "../pict/constraintsHighlighter";
import { useTheme } from "../theme/ThemeContext";
import type { PictModel } from "../types";

interface ModelTabProps {
	model: PictModel;
	activePanel: ActivePanel;
	selectedParamIndex: number;
	newParamName: string;
	valuesInput: string;
	constraintsKey: number;
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	constraintsRef: RefObject<any>;
	selectedSubmodelIndex: number;
	submodelAddingStep: "params" | "order";
	submodelParamsInput: string;
	submodelOrderInput: string;
	submodelDropdownFocused: boolean;
	submodelDropdownOptions: Array<{ name: string; description: string }>;
	submodelValidationError: string | null;
	onParamNavigate: (index: number) => void;
	onValuesChange: (value: string) => void;
	onNewParamNameChange: (name: string) => void;
	onConfirmAddParam: () => void;
	onSubmodelNavigate: (index: number) => void;
	onSubmodelParamsChange: (value: string) => void;
	onSubmodelOrderChange: (value: string) => void;
	onConfirmSubmodelParams: () => void;
	onConfirmSubmodelOrder: () => void;
	onConstraintsChange: (value: string) => void;
	onSubmodelDropdownSelect: (paramName: string) => void;
}

export function ModelTab({
	model,
	activePanel,
	selectedParamIndex,
	newParamName,
	valuesInput,
	constraintsKey,
	constraintsRef,
	selectedSubmodelIndex,
	submodelAddingStep,
	submodelParamsInput,
	submodelOrderInput,
	submodelDropdownFocused,
	submodelDropdownOptions,
	submodelValidationError,
	onParamNavigate,
	onValuesChange,
	onNewParamNameChange,
	onConfirmAddParam,
	onSubmodelNavigate,
	onSubmodelParamsChange,
	onSubmodelOrderChange,
	onConfirmSubmodelParams,
	onConfirmSubmodelOrder,
	onConstraintsChange,
	onSubmodelDropdownSelect,
}: ModelTabProps) {
	const theme = useTheme();

	// biome-ignore lint/correctness/useExhaustiveDependencies: constraintsKey signals textarea remount; model.constraints read intentionally without re-triggering on keystrokes
	useEffect(() => {
		applyPictHighlights(constraintsRef.current, model.constraints);
	}, [constraintsKey]);

	const paramOptions = model.parameters.map((p) => ({
		name: p.name,
		description: p.values.join(", ") || "(no values)",
	}));

	const selectedParam = model.parameters[selectedParamIndex];

	const submodelOptions = model.submodels.map((s) => ({
		name: `{ ${s.paramNames.join(", ")} } @ ${s.order}`,
		description: "",
	}));

	const submodelPanelActive =
		activePanel === "submodels" || activePanel === "submodel-adding";

	return (
		<box flexDirection="column" flexGrow={1}>
			{/* Top row: params + values */}
			<box flexDirection="row" flexGrow={1}>
				{/* Parameters panel */}
				<box
					border
					borderStyle="single"
					borderColor={
						activePanel === "params" || activePanel === "adding"
							? theme.colors.border.active
							: theme.colors.border.inactive
					}
					backgroundColor={theme.colors.bg.panel}
					title=" Parameters "
					titleAlignment="left"
					width="35%"
					flexDirection="column"
				>
					{activePanel === "adding" && (
						<box paddingX={1} backgroundColor={theme.colors.bg.elevated}>
							<box flexDirection="row" gap={1} alignItems="center">
								<text fg={theme.colors.accent}>New:</text>
								<input
									value={newParamName}
									onChange={onNewParamNameChange}
									onSubmit={onConfirmAddParam}
									focused
									placeholder="param name..."
									backgroundColor={theme.colors.bg.elevated}
									focusedBackgroundColor={theme.colors.bg.selected}
									flexGrow={1}
								/>
							</box>
						</box>
					)}
					{paramOptions.length > 0 ? (
						<select
							options={paramOptions}
							selectedIndex={selectedParamIndex}
							onChange={(index) => onParamNavigate(index)}
							focused={activePanel === "params"}
							showScrollIndicator
							flexGrow={1}
						/>
					) : (
						<box flexGrow={1} justifyContent="center" alignItems="center">
							<text fg={theme.colors.text.muted}>No parameters</text>
						</box>
					)}
				</box>

				{/* Values panel */}
				<box
					border
					borderStyle="single"
					borderColor={
						activePanel === "values"
							? theme.colors.border.active
							: theme.colors.border.inactive
					}
					backgroundColor={theme.colors.bg.panel}
					title={selectedParam ? ` Values: ${selectedParam.name} ` : " Values "}
					titleAlignment="left"
					flexGrow={1}
					flexDirection="column"
					padding={1}
				>
					{selectedParam ? (
						<>
							<text fg={theme.colors.text.muted}>Comma-separated values:</text>
							<input
								value={valuesInput}
								onChange={onValuesChange}
								focused={activePanel === "values"}
								placeholder="value1, value2, value3..."
								backgroundColor={theme.colors.bg.base}
								focusedBackgroundColor={theme.colors.bg.elevated}
							/>
							<box marginTop={1}>
								<text fg={theme.colors.text.muted}>
									{selectedParam.values.length} value
									{selectedParam.values.length !== 1 ? "s" : ""}
									{selectedParam.values.length > 0 && ": "}
									{selectedParam.values.map((v, i) => (
										<span key={v}>
											{i > 0 && (
												<span fg={theme.colors.border.inactive}>, </span>
											)}
											<span fg={theme.colors.value}>{v}</span>
										</span>
									))}
								</text>
							</box>
						</>
					) : (
						<box flexGrow={1} justifyContent="center" alignItems="center">
							<text fg={theme.colors.text.muted}>
								Select a parameter to edit values
							</text>
						</box>
					)}
				</box>
			</box>

			{/* Constraints panel */}
			<box
				border
				borderStyle="single"
				borderColor={
					activePanel === "constraints"
						? theme.colors.border.active
						: theme.colors.border.inactive
				}
				backgroundColor={theme.colors.bg.panel}
				title=" Constraints "
				titleAlignment="left"
				height={8}
				padding={1}
			>
				<textarea
					key={constraintsKey}
					ref={constraintsRef}
					initialValue={model.constraints}
					focused={activePanel === "constraints"}
					placeholder={
						'IF [Param] = "Value" THEN [OtherParam] <> "OtherValue";'
					}
					syntaxStyle={getPictSyntaxStyle()}
					wrapMode="word"
					flexGrow={1}
					onContentChange={() => {
						const text = constraintsRef.current?.editBuffer?.getText() ?? "";
						onConstraintsChange(text);
						applyPictHighlights(constraintsRef.current, text);
					}}
				/>
			</box>

			{/* Sub-models panel */}
			<box
				border
				borderStyle="single"
				borderColor={
					submodelPanelActive
						? theme.colors.border.active
						: theme.colors.border.inactive
				}
				backgroundColor={theme.colors.bg.panel}
				title=" Sub-Models "
				titleAlignment="left"
				height={8}
				flexDirection="column"
			>
				{activePanel === "submodel-adding" && (
					<box paddingX={1} backgroundColor={theme.colors.bg.elevated}>
						{submodelAddingStep === "params" ? (
							<box flexDirection="column" position="relative">
								<box flexDirection="row" gap={1} alignItems="center">
									<text fg={theme.colors.accent}>Params:</text>
									<input
										value={submodelParamsInput}
										onChange={onSubmodelParamsChange}
										onSubmit={onConfirmSubmodelParams}
										focused={!submodelDropdownFocused}
										placeholder="Param1, Param2..."
										backgroundColor={theme.colors.bg.elevated}
										focusedBackgroundColor={theme.colors.bg.selected}
										flexGrow={1}
									/>
								</box>
								{submodelValidationError && (
									<text fg="#ff5555">{submodelValidationError}</text>
								)}
								{submodelDropdownOptions.length > 0 && (
									<box
										position="absolute"
										top={1}
										left={8}
										width={30}
										zIndex={10}
										backgroundColor={theme.colors.bg.elevated}
										border
										borderStyle="single"
										borderColor={theme.colors.border.active}
									>
										<select
											options={submodelDropdownOptions}
											focused={submodelDropdownFocused}
											onSelect={(_, option) =>
												option && onSubmodelDropdownSelect(option.name)
											}
											height={Math.min(submodelDropdownOptions.length, 4)}
											showScrollIndicator
											backgroundColor={theme.colors.bg.elevated}
											focusedBackgroundColor={theme.colors.bg.elevated}
											selectedBackgroundColor={theme.colors.bg.selected}
											selectedTextColor={theme.colors.text.primary}
										/>
									</box>
								)}
							</box>
						) : (
							<box flexDirection="row" gap={1} alignItems="center">
								<text fg={theme.colors.accent}>Order:</text>
								<input
									value={submodelOrderInput}
									onChange={onSubmodelOrderChange}
									onSubmit={onConfirmSubmodelOrder}
									focused
									placeholder="2"
									backgroundColor={theme.colors.bg.elevated}
									focusedBackgroundColor={theme.colors.bg.selected}
									flexGrow={1}
								/>
							</box>
						)}
					</box>
				)}
				{submodelOptions.length > 0 ? (
					<select
						options={submodelOptions}
						selectedIndex={selectedSubmodelIndex}
						onChange={(index) => onSubmodelNavigate(index)}
						focused={activePanel === "submodels"}
						showScrollIndicator
						flexGrow={1}
					/>
				) : activePanel !== "submodel-adding" ? (
					<box flexGrow={1} justifyContent="center" alignItems="center">
						<text fg={theme.colors.text.muted}>No sub-models — [a] add</text>
					</box>
				) : null}
			</box>
		</box>
	);
}
