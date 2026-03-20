import type { TestCase } from "../types";

interface ResultsTabProps {
	results: TestCase[];
	focused: boolean;
}

export function ResultsTab({ results, focused }: ResultsTabProps) {
	if (results.length === 0) {
		return (
			<box flexGrow={1} justifyContent="center" alignItems="center">
				<text fg="#666666">No results yet. Press [g] to generate.</text>
			</box>
		);
	}

	const headers = Object.keys(results[0] ?? {});
	const colWidth = Math.max(12, Math.floor(60 / headers.length));

	const headerLine = headers.map((h) => h.padEnd(colWidth)).join(" ");
	const separator = "─".repeat(headerLine.length);

	return (
		<box flexGrow={1} flexDirection="column">
			<box paddingX={1} paddingY={0} backgroundColor="#1a1a2e">
				<text fg="#5fafff">
					<strong>{results.length} test cases</strong>
					<span fg="#666666"> ({headers.length} parameters)</span>
				</text>
			</box>
			<scrollbox focused={focused} flexGrow={1}>
				<box flexDirection="column" paddingX={1}>
					<text fg="#aaaaaa">{headerLine}</text>
					<text fg="#444444">{separator}</text>
					{results.map((row, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: rows are stable and read-only
						<text key={i} fg={i % 2 === 0 ? "#cccccc" : "#aaaaaa"}>
							{headers.map((h) => (row[h] ?? "").padEnd(colWidth)).join(" ")}
						</text>
					))}
				</box>
			</scrollbox>
		</box>
	);
}
