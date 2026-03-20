import type { ModelStorageConfig, OutputConfig, PictOptions } from "../types";

interface OptionsTabProps {
	options: PictOptions;
	outputConfig: OutputConfig;
	modelStorage: ModelStorageConfig;
	activeField:
		| "filepath"
		| "format"
		| "order"
		| "randomize"
		| "caseSensitive"
		| "storagePath"
		| "fileTemplate"
		| "none";
	onOutputConfigChange: (config: OutputConfig) => void;
	onOptionsChange: (opts: PictOptions) => void;
	onModelStorageChange: (cfg: ModelStorageConfig) => void;
}

export function OptionsTab({
	options,
	outputConfig,
	modelStorage,
	activeField,
	onOutputConfigChange,
	onOptionsChange,
	onModelStorageChange,
}: OptionsTabProps) {
	return (
		<box flexDirection="column" padding={2} gap={1} flexGrow={1}>
			<text fg="#5fafff">
				<strong>Output Configuration</strong>
			</text>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg="#aaaaaa" width={20}>
					Output file path:
				</text>
				<input
					value={outputConfig.filePath}
					onChange={(v) =>
						onOutputConfigChange({ ...outputConfig, filePath: v })
					}
					focused={activeField === "filepath"}
					width={40}
					placeholder="./output.txt"
					backgroundColor="#1a1a2e"
					focusedBackgroundColor="#1a2a4a"
				/>
			</box>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={activeField === "format" ? "#1a2a4a" : "transparent"}
			>
				<text fg="#aaaaaa" width={20}>
					Format:
				</text>
				<text fg="#5fafff">{outputConfig.format.toUpperCase()}</text>
				{activeField === "format" && <text fg="#888888"> [Enter] cycle</text>}
			</box>

			<text fg="#5fafff">
				<strong>PICT Options</strong>
			</text>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg="#aaaaaa" width={20}>
					Combination order:
				</text>
				<input
					value={String(options.order)}
					onChange={(v) => {
						const n = parseInt(v, 10);
						if (!Number.isNaN(n) && n >= 1 && n <= 6) {
							onOptionsChange({ ...options, order: n });
						} else if (v === "" || v === "0") {
							onOptionsChange({ ...options, order: 2 });
						}
					}}
					focused={activeField === "order"}
					width={6}
					backgroundColor="#1a1a2e"
					focusedBackgroundColor="#1a2a4a"
				/>
				<text fg="#666666">(1–6, default: 2)</text>
			</box>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "randomize" ? "#1a2a4a" : "transparent"
				}
			>
				<text fg="#aaaaaa" width={20}>
					Randomize:
				</text>
				<text fg={options.randomize ? "#5fafff" : "#666666"}>
					{options.randomize ? "● ON" : "○ OFF"}
				</text>
				{activeField === "randomize" && (
					<text fg="#888888"> [Enter] toggle</text>
				)}
			</box>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "caseSensitive" ? "#1a2a4a" : "transparent"
				}
			>
				<text fg="#aaaaaa" width={20}>
					Case sensitive:
				</text>
				<text fg={options.caseSensitive ? "#5fafff" : "#666666"}>
					{options.caseSensitive ? "● ON" : "○ OFF"}
				</text>
				{activeField === "caseSensitive" && (
					<text fg="#888888"> [Enter] toggle</text>
				)}
			</box>

			<text fg="#5fafff">
				<strong>Model Storage</strong>
			</text>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg="#aaaaaa" width={20}>
					Storage path:
				</text>
				<input
					value={modelStorage.storagePath}
					onChange={(v) =>
						onModelStorageChange({ ...modelStorage, storagePath: v })
					}
					focused={activeField === "storagePath"}
					width={40}
					placeholder="./"
					backgroundColor="#1a1a2e"
					focusedBackgroundColor="#1a2a4a"
				/>
			</box>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg="#aaaaaa" width={20}>
					File template:
				</text>
				<input
					value={modelStorage.fileTemplate}
					onChange={(v) =>
						onModelStorageChange({ ...modelStorage, fileTemplate: v })
					}
					focused={activeField === "fileTemplate"}
					width={40}
					placeholder="model_{timestamp}"
					backgroundColor="#1a1a2e"
					focusedBackgroundColor="#1a2a4a"
				/>
				<text fg="#666666">{"{timestamp} = ISO date"}</text>
			</box>

			<box marginTop={1}>
				<text fg="#666666">
					Use [Tab] to cycle through fields, [Esc] to unfocus
				</text>
			</box>
		</box>
	);
}
