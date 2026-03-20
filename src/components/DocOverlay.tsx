import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import { DOC_CHAPTERS } from "../docs/pict-docs";

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
					borderColor="#5fafff"
					width={60}
					flexDirection="column"
					padding={1}
				>
					<box marginBottom={1}>
						<text fg="#5fafff">PICT Documentation</text>
					</box>
					{DOC_CHAPTERS.map((ch, i) => (
						<box
							key={ch.title}
							paddingX={1}
							backgroundColor={
								i === selectedChapterIdx ? "#1a3a5c" : "transparent"
							}
						>
							<text fg={i === selectedChapterIdx ? "#ffffff" : "#aaaaaa"}>
								{i === selectedChapterIdx ? "▶ " : "  "}
								{ch.title}
							</text>
						</box>
					))}
					<box marginTop={1}>
						<text fg="#666666">[↑↓] navigate [Enter] open [Esc] close</text>
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
				<text fg="#5fafff">{chapter.title}</text>
				<text fg="#666666">{"  "}[↑↓] scroll [Esc] back to list</text>
			</box>
			<scrollbox ref={scrollRef} flexGrow={1}>
				{chapter.content.map((line, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static content, indices are stable
					<box key={i}>
						<text fg="#cccccc">{line || " "}</text>
					</box>
				))}
			</scrollbox>
		</box>
	);
}
