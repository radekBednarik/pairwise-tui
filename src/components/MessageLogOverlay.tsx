import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import { useTheme } from "../theme/ThemeContext";
import type { LogMessage } from "../types";

interface MessageLogOverlayProps {
	messages: LogMessage[];
	selectedIndex: number;
	scrollOffset: number;
}

export function MessageLogOverlay({
	messages,
	selectedIndex,
	scrollOffset,
}: MessageLogOverlayProps) {
	const theme = useTheme();
	const scrollRef = useRef<ScrollBoxRenderable | null>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollOffset;
		}
	}, [scrollOffset]);

	return (
		<box flexGrow={1} flexDirection="column" padding={1}>
			<box marginBottom={1} flexDirection="row">
				<text fg={theme.colors.accent}>Message Log</text>
				<text fg={theme.colors.text.muted}>
					{"  "}({messages.length} entries)
				</text>
			</box>
			<scrollbox ref={scrollRef} flexGrow={1}>
				{messages.length === 0 ? (
					<box>
						<text fg={theme.colors.text.muted}>No messages yet.</text>
					</box>
				) : (
					messages.map((msg, i) => {
						const isSelected = i === selectedIndex;
						const ts = msg.timestamp.toLocaleTimeString();
						const badge = msg.type === "error" ? "ERR" : "INF";
						const badgeColor =
							msg.type === "error"
								? theme.colors.status.error
								: theme.colors.status.success;
						return (
							<box
								key={msg.id}
								paddingX={1}
								backgroundColor={
									isSelected ? theme.colors.bg.selected : "transparent"
								}
								flexDirection="row"
							>
								<text fg={theme.colors.text.muted}>{ts} </text>
								<text fg={badgeColor}>[{badge}] </text>
								<text
									fg={
										isSelected
											? theme.colors.text.primary
											: theme.colors.text.secondary
									}
								>
									{msg.text}
								</text>
							</box>
						);
					})
				)}
			</scrollbox>
		</box>
	);
}
