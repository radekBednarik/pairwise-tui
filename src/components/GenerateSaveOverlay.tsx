import { useTheme } from "../theme/ThemeContext";
import type { OutputFormat } from "../types";
import { TIMESTAMP_PLACEHOLDER } from "../utils/fileTemplate";

interface GenerateSaveOverlayProps {
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	inputRef: any;
	path: string;
	format: OutputFormat;
	onPathChange: (value: string) => void;
	onSubmit: () => void;
}

export function GenerateSaveOverlay({
	inputRef,
	path,
	format,
	onPathChange,
	onSubmit,
}: GenerateSaveOverlayProps) {
	const theme = useTheme();

	return (
		<box
			flexGrow={1}
			justifyContent="center"
			alignItems="center"
			flexDirection="column"
		>
			<box
				border
				borderColor={theme.colors.border.active}
				backgroundColor={theme.colors.bg.panel}
				width={72}
				flexDirection="column"
				padding={1}
			>
				<box paddingX={1} marginBottom={1}>
					<text>
						<span fg={theme.colors.accent}>Save Test Cases</span>
						<span fg={theme.colors.text.muted}> - choose file and format</span>
					</text>
				</box>

				<box
					paddingX={1}
					flexDirection="row"
					alignItems="center"
					marginBottom={1}
				>
					<text fg={theme.colors.text.secondary}>File: </text>
					<input
						ref={inputRef}
						value={path}
						onChange={onPathChange}
						onSubmit={onSubmit}
						placeholder="./output_{timestamp}.txt"
						width={58}
						focused
						textColor={theme.colors.text.primary}
						backgroundColor={theme.colors.bg.elevated}
						cursorColor={theme.colors.accent}
						placeholderColor={theme.colors.text.muted}
					/>
				</box>

				<box paddingX={1} flexDirection="row" alignItems="center">
					<text fg={theme.colors.text.secondary}>Format: </text>
					<text fg={theme.colors.accent}>{format.toUpperCase()}</text>
					<text fg={theme.colors.text.muted}> [↑↓] cycle</text>
				</box>

				<box paddingX={1} marginBottom={1}>
					<text fg={theme.colors.text.muted}>
						{TIMESTAMP_PLACEHOLDER} = UTC ISO date
					</text>
				</box>

				<box paddingX={1} marginTop={1}>
					<text>
						<span fg={theme.colors.accent}>[Enter]</span>
						<span fg={theme.colors.text.secondary}> Save </span>
						<span fg={theme.colors.accent}>[↑↓]</span>
						<span fg={theme.colors.text.secondary}> Format </span>
						<span fg={theme.colors.accent}>[Esc]</span>
						<span fg={theme.colors.text.secondary}> Skip</span>
					</text>
				</box>
			</box>
		</box>
	);
}
