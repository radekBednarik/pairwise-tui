import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";
import { useTheme } from "../theme/ThemeContext";
import { choicesFor, type UpdateSnapshot } from "../update/controller";

interface UpdateOverlayProps {
	snapshot: UpdateSnapshot;
	installedVersion: string;
}

function megabytes(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Choices({
	choices,
	selectedIndex,
}: {
	choices: readonly string[];
	selectedIndex: number;
}) {
	const theme = useTheme();
	return (
		<box flexDirection="row" gap={1}>
			{choices.map((choice, i) => (
				<box
					key={choice}
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
						{choice}
					</text>
				</box>
			))}
		</box>
	);
}

/**
 * The update overlay in all its phases. It only draws the controller's
 * snapshot: which choices exist and what a key does is decided there.
 */
export function UpdateOverlay({
	snapshot,
	installedVersion,
}: UpdateOverlayProps) {
	const theme = useTheme();
	const scrollRef = useRef<ScrollBoxRenderable | null>(null);
	const { phase, available, choiceIndex, notesScroll, progress } = snapshot;

	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = notesScroll;
	}, [notesScroll]);

	const choices = choicesFor(phase);

	if (phase === "offer" || phase === "notice") {
		if (!available) return null;
		// Sanitized where it was received (release.ts): plain text, no control
		// characters. Shown as-is; markdown is deliberately not rendered.
		const lines = available.notes === "" ? [] : available.notes.split("\n");
		return (
			<box flexGrow={1} flexDirection="column" padding={1}>
				<box marginBottom={1} flexShrink={0}>
					<text fg={theme.colors.accent}>
						<strong>Update available</strong>
					</text>
				</box>
				<box flexDirection="row" gap={3} flexShrink={0}>
					<text fg={theme.colors.text.secondary}>
						Installed: {installedVersion}
					</text>
					<text fg={theme.colors.text.primary}>New: {available.version}</text>
					<text fg={theme.colors.text.secondary}>
						Download size: {megabytes(available.sizeBytes)}
					</text>
				</box>
				{phase === "notice" && (
					<box flexDirection="column" marginTop={1} flexShrink={0}>
						<text fg={theme.colors.text.primary}>
							This installation cannot update itself (no write permission).
						</text>
						<text fg={theme.colors.text.secondary}>
							Download: {available.pageUrl}
						</text>
					</box>
				)}
				{/* The notes take what is left: every other row keeps its height. */}
				<box
					flexGrow={1}
					flexShrink={1}
					flexBasis={0}
					minHeight={3}
					marginTop={1}
					border
					borderColor={theme.colors.border.inactive}
					flexDirection="column"
				>
					<scrollbox ref={scrollRef} flexGrow={1}>
						{lines.length === 0 ? (
							<text fg={theme.colors.text.muted}>(no release notes)</text>
						) : (
							lines.map((line, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static content, indices are stable
								<box key={i}>
									<text fg={theme.colors.text.secondary}>{line || " "}</text>
								</box>
							))
						)}
					</scrollbox>
				</box>
				<box marginTop={1} flexShrink={0}>
					<Choices choices={choices} selectedIndex={choiceIndex} />
				</box>
				<box marginTop={1} flexShrink={0}>
					<text fg={theme.colors.text.muted}>
						[←→] choose [Enter] confirm [↑↓] scroll notes [Esc]{" "}
						{phase === "notice" ? "close" : "not now"}
					</text>
				</box>
			</box>
		);
	}

	let body: React.ReactNode = null;
	let hint = "";
	if (phase === "unsavedWarning") {
		body = (
			<>
				<box paddingX={1} marginBottom={1}>
					<text fg={theme.colors.text.primary}>
						Restarting will discard unsaved work.
					</text>
				</box>
				{snapshot.warningError !== "" && (
					<box paddingX={1} marginBottom={1}>
						<text fg={theme.colors.status.error}>{snapshot.warningError}</text>
					</box>
				)}
				<Choices choices={choices} selectedIndex={choiceIndex} />
			</>
		);
		hint = "[←→] choose [Enter] confirm [Esc] go back";
	} else if (phase === "downloading" && available && progress) {
		const percent =
			progress.total > 0
				? Math.min(100, Math.floor((progress.received / progress.total) * 100))
				: 0;
		body = (
			<box paddingX={1} flexDirection="column">
				<text fg={theme.colors.text.primary}>
					Downloading {available.version}
				</text>
				<text fg={theme.colors.text.secondary}>
					{progress.stage === "downloading"
						? `${percent}% (${megabytes(progress.received)} of ${megabytes(progress.total)})`
						: progress.stage === "verifying"
							? "Verifying"
							: "Installing"}
				</text>
			</box>
		);
		hint = progress.stage === "installing" ? "Please wait" : "[Esc] cancel";
	} else if (phase === "error") {
		body = (
			<>
				<box paddingX={1} marginBottom={1} flexDirection="column">
					<text fg={theme.colors.status.error}>{snapshot.errorText}</text>
					{snapshot.errorUrl !== null && (
						<text fg={theme.colors.text.secondary}>{snapshot.errorUrl}</text>
					)}
				</box>
				<Choices choices={choices} selectedIndex={choiceIndex} />
			</>
		);
		hint = "[Enter] close";
	}
	if (body === null) return null;

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
				width={84}
				flexDirection="column"
				padding={1}
			>
				{body}
				<box marginTop={1}>
					<text fg={theme.colors.text.muted}>{hint}</text>
				</box>
			</box>
		</box>
	);
}
