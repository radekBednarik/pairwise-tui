import { basename } from "node:path";
import { useTheme } from "../theme/ThemeContext";

interface FilePickerOverlayProps {
	files: string[];
	selectedIndex: number;
}

export function FilePickerOverlay({
	files,
	selectedIndex,
}: FilePickerOverlayProps) {
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
				width={60}
				flexDirection="column"
				padding={1}
			>
				{files.map((f, i) => (
					<box
						key={f}
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
							{basename(f)}
						</text>
					</box>
				))}
				<box marginTop={1}>
					<text fg={theme.colors.text.muted}>
						[↑↓] navigate [Enter] open [Esc] cancel
					</text>
				</box>
			</box>
		</box>
	);
}
