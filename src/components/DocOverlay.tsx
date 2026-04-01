import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import { DOC_CHAPTERS } from "../docs/pict-docs";
import { useTheme } from "../theme/ThemeContext";

interface DocOverlayProps {
	view: "list" | "chapter";
	selectedChapterIdx: number;
	scrollOffset: number;
}

export function DocOverlay({
	view,
	selectedChapterIdx,
	scrollOffset,
}: DocOverlayProps) {
	const theme = useTheme();
	const scrollRef = useRef<ScrollBoxRenderable | null>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollOffset;
		}
	}, [scrollOffset]);

	if (view === "list") {
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
					<box marginBottom={1}>
						<text fg={theme.colors.accent}>Pairwise TUI docs</text>
					</box>
					{DOC_CHAPTERS.map((ch, i) => (
						<box
							key={ch.title}
							paddingX={1}
							backgroundColor={
								i === selectedChapterIdx
									? theme.colors.bg.selected
									: "transparent"
							}
						>
							<text
								fg={
									i === selectedChapterIdx
										? theme.colors.text.primary
										: theme.colors.text.secondary
								}
							>
								{i === selectedChapterIdx ? "▶ " : "  "}
								{ch.title}
							</text>
						</box>
					))}
					<box marginTop={1}>
						<text fg={theme.colors.text.muted}>
							[↑↓] navigate [Enter] open [Esc] close
						</text>
					</box>
				</box>
			</box>
		);
	}

	const chapter = DOC_CHAPTERS[selectedChapterIdx];
	if (!chapter) return null;

	return (
		<box flexGrow={1} flexDirection="column" padding={1}>
			<box marginBottom={1}>
				<text fg={theme.colors.accent}>{chapter.title}</text>
				<text fg={theme.colors.text.muted}>
					{"  "}[↑↓] scroll [Esc] back to list
				</text>
			</box>
			<scrollbox ref={scrollRef} flexGrow={1}>
				{chapter.content.map((line, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static content, indices are stable
					<box key={i}>
						<text fg={theme.colors.text.secondary}>{line || " "}</text>
					</box>
				))}
			</scrollbox>
		</box>
	);
}
