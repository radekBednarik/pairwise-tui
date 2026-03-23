import { useTheme } from "../theme/ThemeContext";

interface ClearConfirmOverlayProps {
	selectedIndex: number; // 0 = Yes, 1 = Cancel
}

const OPTIONS = ["Yes, clear everything", "Cancel"];

export function ClearConfirmOverlay({
	selectedIndex,
}: ClearConfirmOverlayProps) {
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
				width={54}
				flexDirection="column"
				padding={1}
			>
				<box paddingX={1} marginBottom={1}>
					<text fg={theme.colors.text.primary}>
						This will remove all parameters, values, and constraints.
					</text>
				</box>
				{OPTIONS.map((opt, i) => (
					<box
						key={opt}
						paddingX={1}
						backgroundColor={
							i === selectedIndex ? theme.colors.bg.selected : "transparent"
						}
					>
						<text
							fg={
								i === selectedIndex
									? theme.colors.text.primary
									: theme.colors.text.secondary
							}
						>
							{i === selectedIndex ? "▶ " : "  "}
							{opt}
						</text>
					</box>
				))}
				<box marginTop={1}>
					<text fg={theme.colors.text.muted}>
						[↑↓] navigate [Enter] confirm [Esc] cancel
					</text>
				</box>
			</box>
		</box>
	);
}
