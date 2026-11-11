import { useTerminalDimensions } from "@opentui/react";
import type { ActiveOptionField } from "../constants";
import { useTheme } from "../theme/ThemeContext";
import {
	AI_MODEL_LABELS,
	type AiModel,
	type ModelStorageConfig,
	type OutputConfig,
	type PictOptions,
} from "../types";
import { TIMESTAMP_PLACEHOLDER } from "../utils/fileTemplate";

const TEMPLATE_HINT = `${TIMESTAMP_PLACEHOLDER} = UTC ISO date`;

// Terminal height from which every row of the tab fits with a blank line
// between rows. Below it the rows are packed, because rows that do not fit
// are squeezed onto each other and become unreadable.
const ROOMY_MIN_HEIGHT = 48;

interface OptionsTabProps {
	options: PictOptions;
	outputConfig: OutputConfig;
	modelStorage: ModelStorageConfig;
	aiModel: AiModel;
	promptOnGenerate: boolean;
	activeField: ActiveOptionField;
	/** The Updates section: installed version, setting and current state. */
	update: {
		version: string;
		autoUpdate: boolean;
		/** False when this run cannot update itself at all. */
		available: boolean;
		stateText: string | null;
	};
	onOutputConfigChange: (config: OutputConfig) => void;
	onOptionsChange: (opts: PictOptions) => void;
	onModelStorageChange: (cfg: ModelStorageConfig) => void;
}

export function OptionsTab({
	options,
	outputConfig,
	modelStorage,
	aiModel,
	promptOnGenerate,
	activeField,
	update,
	onOutputConfigChange,
	onOptionsChange,
	onModelStorageChange,
}: OptionsTabProps) {
	const theme = useTheme();
	const { height } = useTerminalDimensions();
	const roomy = height >= ROOMY_MIN_HEIGHT;

	return (
		<box
			flexDirection="column"
			padding={roomy ? 2 : 1}
			gap={roomy ? 1 : 0}
			flexGrow={1}
		>
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
					placeholder="./output_{timestamp}.txt"
					backgroundColor={theme.colors.bg.base}
					focusedBackgroundColor={theme.colors.bg.elevated}
				/>
				<text fg={theme.colors.text.muted}>{TEMPLATE_HINT}</text>
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

			<box
				flexDirection="row"
				gap={2}
				alignItems="center"
				paddingX={1}
				backgroundColor={
					activeField === "promptOnGenerate"
						? theme.colors.bg.elevated
						: "transparent"
				}
			>
				<text fg={theme.colors.text.muted} width={20}>
					Ask where to save:
				</text>
				<text
					fg={promptOnGenerate ? theme.colors.accent : theme.colors.text.muted}
				>
					{promptOnGenerate ? "● ON" : "○ OFF"}
				</text>
				<text fg={theme.colors.text.muted}>
					(dialog after each [g] generate)
				</text>
				{activeField === "promptOnGenerate" && (
					<text fg={theme.colors.text.muted}> [Enter] toggle</text>
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
				<text fg={theme.colors.text.muted}>{TEMPLATE_HINT}</text>
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

			{/* One block without gaps: the tab is already tall, so the section
			    adds as few rows as it can. */}
			<box flexDirection="column">
				<box flexDirection="row" gap={2}>
					<text fg={theme.colors.accent}>
						<strong>Updates</strong>
					</text>
					<text fg={theme.colors.text.muted}>Version: {update.version}</text>
				</box>

				<box
					flexDirection="row"
					gap={2}
					alignItems="center"
					paddingX={1}
					backgroundColor={
						activeField === "autoUpdate"
							? theme.colors.bg.elevated
							: "transparent"
					}
				>
					<text fg={theme.colors.text.muted} width={20}>
						Automatic updates:
					</text>
					<text
						fg={
							update.available && update.autoUpdate
								? theme.colors.accent
								: theme.colors.text.muted
						}
					>
						{update.autoUpdate ? "● ON" : "○ OFF"}
					</text>
					{activeField === "autoUpdate" && update.available && (
						<text fg={theme.colors.text.muted}> [Enter] toggle</text>
					)}
				</box>

				<box
					flexDirection="row"
					gap={2}
					alignItems="center"
					paddingX={1}
					backgroundColor={
						activeField === "checkUpdates"
							? theme.colors.bg.elevated
							: "transparent"
					}
				>
					<text
						fg={
							update.available
								? theme.colors.text.secondary
								: theme.colors.text.muted
						}
					>
						Check for updates now
					</text>
					{activeField === "checkUpdates" && update.available && (
						<text fg={theme.colors.text.muted}> [Enter] check</text>
					)}
				</box>

				{update.stateText !== null && (
					<box paddingX={1}>
						<text fg={theme.colors.text.muted}>{update.stateText}</text>
					</box>
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
