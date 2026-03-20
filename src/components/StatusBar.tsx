interface StatusBarProps {
	activeTab: number;
	activePanel: string;
	addingParam: boolean;
	hasResults: boolean;
	activeOptionField: string;
}

export function StatusBar({
	activeTab,
	activePanel,
	addingParam,
	hasResults,
	activeOptionField,
}: StatusBarProps) {
	const hints = getHints(
		activeTab,
		activePanel,
		addingParam,
		hasResults,
		activeOptionField,
	);

	return (
		<box
			borderStyle="single"
			borderColor="#444444"
			paddingX={1}
			flexDirection="row"
			flexWrap="wrap"
		>
			<text>
				{hints.map((h, i) => (
					<span key={h.key}>
						<span fg="#888888">{i > 0 ? "  " : ""}</span>
						<span fg="#5fafff">[{h.key}]</span>
						<span fg="#cccccc">{h.label}</span>
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
): Array<{ key: string; label: string }> {
	const common: Array<{ key: string; label: string }> = [
		{ key: "1/2/3", label: "Switch tab" },
		{ key: "q", label: "Quit" },
	];

	if (addingParam) {
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
				{ key: "g", label: "Generate" },
				{ key: "o", label: "Open model" },
				{ key: "w", label: "Save model" },
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
	}

	if (activeTab === 1) {
		if (activeOptionField === "none") {
			return [
				{ key: "Tab", label: "Focus field" },
				{ key: "g", label: "Generate" },
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
		return [...hints, ...common];
	}

	return common;
}
