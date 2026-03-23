import type { RefObject } from "react";
import { useTheme } from "../theme/ThemeContext";
import type { PictModel } from "../types";

interface ModelTabProps {
	model: PictModel;
	activePanel: "params" | "values" | "constraints" | "adding";
	selectedParamIndex: number;
	newParamName: string;
	valuesInput: string;
	constraintsKey: number;
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	constraintsRef: RefObject<any>;
	onParamNavigate: (index: number) => void;
	onValuesChange: (value: string) => void;
	onNewParamNameChange: (name: string) => void;
	onConfirmAddParam: () => void;
}

export function ModelTab({
	model,
	activePanel,
	selectedParamIndex,
	newParamName,
	valuesInput,
	constraintsKey,
	constraintsRef,
	onParamNavigate,
	onValuesChange,
	onNewParamNameChange,
	onConfirmAddParam,
}: ModelTabProps) {
	const theme = useTheme();

	const paramOptions = model.parameters.map((p) => ({
		name: p.name,
		description: p.values.join(", ") || "(no values)",
	}));

	const selectedParam = model.parameters[selectedParamIndex];

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
					wrapMode="word"
					flexGrow={1}
				/>
			</box>
		</box>
	);
}
