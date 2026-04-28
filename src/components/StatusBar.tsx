import { useTheme } from "../theme/ThemeContext";

interface StatusBarProps {
	activeTab: number;
	activePanel: string;
	addingParam: boolean;
	hasResults: boolean;
	activeOptionField: string;
	hasAiKey: boolean;
}

export function StatusBar({
	activeTab,
	activePanel,
	addingParam,
	hasResults,
	activeOptionField,
	hasAiKey,
}: StatusBarProps) {
	const theme = useTheme();
	const hints = getHints(
		activeTab,
		activePanel,
		addingParam,
		hasResults,
		activeOptionField,
		hasAiKey,
	);

	return (
		<box
			borderStyle="single"
			borderColor={theme.colors.border.inactive}
			backgroundColor={theme.colors.bg.header}
			paddingX={1}
			flexDirection="row"
			flexWrap="wrap"
		>
			<text>
				{hints.map((h, i) => (
					<span key={h.key}>
						<span fg={theme.colors.text.muted}>{i > 0 ? "  " : ""}</span>
						<span fg={theme.colors.accent}>[{h.key}]</span>
						<span fg={theme.colors.text.secondary}>{h.label}</span>
					</span>
				))}
			</text>
		</box>
	);
}

function getHints(
	activeTab: number,
	activePanel: string,
	addingParam: boolean,
	hasResults: boolean,
	activeOptionField: string,
	hasAiKey: boolean,
): Array<{ key: string; label: string }> {
	const common: Array<{ key: string; label: string }> = [
		{ key: "i", label: hasAiKey ? "AI fill" : "AI setup" },
		...(hasAiKey ? [{ key: "F2", label: "AI setup" }] : []),
		{ key: "1/2/3", label: "Switch tab" },
		{ key: "m", label: "Log" },
		{ key: "t", label: "Theme" },
		{ key: "q", label: "Quit" },
	];

	if (activePanel === "aiSetup") {
		return [
			{ key: "Enter", label: "Save key" },
			{ key: "d", label: "Clear key" },
			{ key: "Esc", label: "Close" },
		];
	}

	if (activePanel === "aiPrompt") {
		return [
			{ key: "Ctrl+G", label: "Generate" },
			{ key: "F2", label: "Setup" },
			{ key: "Esc", label: "Cancel" },
		];
	}

	if (activePanel === "log") {
		return [
			{ key: "↑↓", label: "Navigate" },
			{ key: "c", label: "Copy selected" },
			{ key: "a", label: "Copy all" },
			{ key: "m/Esc", label: "Close" },
		];
	}

	if (activePanel === "docs") {
		return [
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Open" },
			{ key: "Esc", label: "Close" },
		];
	}

	if (activePanel === "picker") {
		return [
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Open" },
			{ key: "Esc", label: "Cancel" },
		];
	}

	if (activePanel === "clearConfirm") {
		return [
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Confirm" },
			{ key: "Esc", label: "Cancel" },
		];
	}

	if (addingParam || activePanel === "submodel-adding") {
		return [
			{ key: "Enter", label: "Confirm" },
			{ key: "Esc", label: "Cancel" },
		];
	}

	if (activeTab === 0) {
		if (activePanel === "params") {
			return [
				{ key: "a", label: "Add param" },
				{ key: "d", label: "Delete" },
				{ key: "e", label: "Edit values" },
				{ key: "c", label: "Constraints" },
				{ key: "b", label: "Sub-models" },
				{ key: "x", label: "Clear model" },
				{ key: "g", label: "Generate" },
				{ key: "o", label: "Open model" },
				{ key: "w", label: "Save model" },
				{ key: "?", label: "Docs" },
				...common,
			];
		}
		if (activePanel === "values" || activePanel === "constraints") {
			return [
				{ key: "Esc", label: "Back to params" },
				{ key: "g", label: "Generate" },
				...common,
			];
		}
		if (activePanel === "submodels") {
			return [
				{ key: "a", label: "Add sub-model" },
				{ key: "d", label: "Delete" },
				{ key: "Esc", label: "Back to params" },
				{ key: "g", label: "Generate" },
				...common,
			];
		}
	}

	if (activeTab === 1) {
		if (activeOptionField === "none") {
			return [
				{ key: "Tab", label: "Focus field" },
				{ key: "g", label: "Generate" },
				{ key: "?", label: "Docs" },
				...common,
			];
		}
		return [
			{ key: "Tab", label: "Next field" },
			{ key: "Esc", label: "Unfocus" },
			...common,
		];
	}

	if (activeTab === 2) {
		const hints: Array<{ key: string; label: string }> = [
			{ key: "↑↓", label: "Scroll" },
		];
		if (hasResults) hints.push({ key: "s", label: "Save results" });
		hints.push({ key: "?", label: "Docs" });
		return [...hints, ...common];
	}

	return common;
}
