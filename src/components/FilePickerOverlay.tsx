import { basename } from "node:path";

interface FilePickerOverlayProps {
	files: string[];
	selectedIndex: number;
}

export function FilePickerOverlay({
	files,
	selectedIndex,
}: FilePickerOverlayProps) {
	return (
		<box
			flexGrow={1}
			justifyContent="center"
			alignItems="center"
			flexDirection="column"
		>
			<box
				border
				borderColor="#5fafff"
				width={60}
				flexDirection="column"
				padding={1}
			>
				{files.map((f, i) => (
					<box
						key={f}
						paddingX={1}
						backgroundColor={i === selectedIndex ? "#1a3a5c" : "transparent"}
					>
						<text fg={i === selectedIndex ? "#ffffff" : "#aaaaaa"}>
							{i === selectedIndex ? "▶ " : "  "}
							{basename(f)}
						</text>
					</box>
				))}
				<box marginTop={1}>
					<text fg="#666666">[↑↓] navigate [Enter] open [Esc] cancel</text>
				</box>
			</box>
		</box>
	);
}
