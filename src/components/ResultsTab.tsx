import { useTheme } from "../theme/ThemeContext";
import type { TestCase } from "../types";

interface ResultsTabProps {
	results: TestCase[];
	focused: boolean;
}

export function ResultsTab({ results, focused }: ResultsTabProps) {
	const theme = useTheme();

	if (results.length === 0) {
		return (
			<box flexGrow={1} justifyContent="center" alignItems="center">
				<text fg={theme.colors.text.muted}>
					No results yet. Press [g] to generate.
				</text>
			</box>
		);
	}

	const headers = Object.keys(results[0] ?? {});

	// Per-column width = max of header length and the longest value in that column
	const colWidths = headers.map((h) =>
		Math.max(h.length, ...results.map((row) => (row[h] ?? "").length)),
	);

	const headerLine = headers
		.map((h, i) => h.padEnd(colWidths[i] ?? 0))
		.join("  ");
	const separator = "─".repeat(headerLine.length);

	return (
		<box
			flexGrow={1}
			flexDirection="column"
			backgroundColor={theme.colors.bg.panel}
		>
			<box paddingX={1} paddingY={0} backgroundColor={theme.colors.bg.elevated}>
				<text fg={theme.colors.accent}>
					<strong>{results.length} test cases</strong>
					<span fg={theme.colors.text.muted}>
						{" "}
						({headers.length} parameters)
					</span>
				</text>
			</box>
			<box flexGrow={1}>
				<scrollbox focused={focused} height="100%">
					<box flexDirection="column" paddingX={1}>
						<text fg={theme.colors.accent}>{headerLine}</text>
						<text fg={theme.colors.border.inactive}>{separator}</text>
						{results.map((row, i) => (
							<text
								// biome-ignore lint/suspicious/noArrayIndexKey: rows are stable and read-only
								key={i}
								fg={
									i % 2 === 0
										? theme.colors.text.primary
										: theme.colors.text.secondary
								}
							>
								{headers
									.map((h, i) => (row[h] ?? "").padEnd(colWidths[i] ?? 0))
									.join("  ")}
							</text>
						))}
					</box>
				</scrollbox>
			</box>
		</box>
	);
}
