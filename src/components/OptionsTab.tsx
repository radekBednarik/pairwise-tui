import type { ActiveOptionField } from "../constants";
import { useTheme } from "../theme/ThemeContext";
import {
	AI_MODEL_LABELS,
	type AiModel,
	type ModelStorageConfig,
	type OutputConfig,
	type PictOptions,
} from "../types";

interface OptionsTabProps {
	options: PictOptions;
	outputConfig: OutputConfig;
	modelStorage: ModelStorageConfig;
	aiModel: AiModel;
	activeField: ActiveOptionField;
	onOutputConfigChange: (config: OutputConfig) => void;
	onOptionsChange: (opts: PictOptions) => void;
	onModelStorageChange: (cfg: ModelStorageConfig) => void;
}

export function OptionsTab({
	options,
	outputConfig,
	modelStorage,
	aiModel,
	activeField,
	onOutputConfigChange,
	onOptionsChange,
	onModelStorageChange,
}: OptionsTabProps) {
	const theme = useTheme();

	return (
		<box flexDirection="column" padding={2} gap={1} flexGrow={1}>
			<text fg={theme.colors.accent}>
				<strong>Output Configuration</strong>
			</text>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg={theme.colors.text.muted} width={20}>
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
					backgroundColor={theme.colors.bg.base}
					focusedBackgroundColor={theme.colors.bg.elevated}
				/>
			</box>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "format" ? theme.colors.bg.elevated : "transparent"
				}
			>
				<text fg={theme.colors.text.muted} width={20}>
					Format:
				</text>
				<text fg={theme.colors.accent}>
					{outputConfig.format.toUpperCase()}
				</text>
				{activeField === "format" && (
					<text fg={theme.colors.text.muted}> [Enter] cycle</text>
				)}
			</box>

			<text fg={theme.colors.accent}>
				<strong>PICT Options</strong>
			</text>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg={theme.colors.text.muted} width={20}>
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
					backgroundColor={theme.colors.bg.base}
					focusedBackgroundColor={theme.colors.bg.elevated}
				/>
				<text fg={theme.colors.text.muted}>(1–6, default: 2)</text>
			</box>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "randomize" ? theme.colors.bg.elevated : "transparent"
				}
			>
				<text fg={theme.colors.text.muted} width={20}>
					Randomize:
				</text>
				<text
					fg={options.randomize ? theme.colors.accent : theme.colors.text.muted}
				>
					{options.randomize ? "● ON" : "○ OFF"}
				</text>
				{activeField === "randomize" && (
					<text fg={theme.colors.text.muted}> [Enter] toggle</text>
				)}
			</box>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "caseSensitive"
						? theme.colors.bg.elevated
						: "transparent"
				}
			>
				<text fg={theme.colors.text.muted} width={20}>
					Case sensitive:
				</text>
				<text
					fg={
						options.caseSensitive
							? theme.colors.accent
							: theme.colors.text.muted
					}
				>
					{options.caseSensitive ? "● ON" : "○ OFF"}
				</text>
				{activeField === "caseSensitive" && (
					<text fg={theme.colors.text.muted}> [Enter] toggle</text>
				)}
			</box>

			<text fg={theme.colors.accent}>
				<strong>Model Storage</strong>
			</text>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg={theme.colors.text.muted} width={20}>
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
					backgroundColor={theme.colors.bg.base}
					focusedBackgroundColor={theme.colors.bg.elevated}
				/>
			</box>

			<box flexDirection="row" gap={2} alignItems="center">
				<text fg={theme.colors.text.muted} width={20}>
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
					backgroundColor={theme.colors.bg.base}
					focusedBackgroundColor={theme.colors.bg.elevated}
				/>
				<text fg={theme.colors.text.muted}>{"{timestamp} = ISO date"}</text>
			</box>

			<text fg={theme.colors.accent}>
				<strong>AI Settings</strong>
			</text>

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "aiModel" ? theme.colors.bg.elevated : "transparent"
				}
			>
				<text fg={theme.colors.text.muted} width={20}>
					AI Model:
				</text>
				<text fg={theme.colors.accent}>{AI_MODEL_LABELS[aiModel]}</text>
				{activeField === "aiModel" && (
					<text fg={theme.colors.text.muted}> [Enter] cycle</text>
				)}
			</box>

			<box marginTop={1}>
				<text fg={theme.colors.text.muted}>
					Use [Tab] to cycle through fields, [Esc] to unfocus
				</text>
			</box>
		</box>
	);
}
