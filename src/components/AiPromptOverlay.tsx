import type { RefObject } from "react";
import { useTheme } from "../theme/ThemeContext";
import { AI_MODEL_LABELS, type AiModel } from "../types";

interface AiPromptOverlayProps {
	// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
	textareaRef: RefObject<any>;
	textareaKey: number;
	isLoading: boolean;
	error: string;
	aiModel: AiModel;
}

export function AiPromptOverlay({
	textareaRef,
	textareaKey,
	isLoading,
	error,
	aiModel,
}: AiPromptOverlayProps) {
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
				{/* Title */}
				<box paddingX={1} marginBottom={1}>
					<text>
						<span fg={theme.colors.accent}>AI Parameter Generator</span>
						<span fg={theme.colors.text.muted}>
							{" "}
							— {AI_MODEL_LABELS[aiModel]}
						</span>
					</text>
				</box>

				{/* Input area or loading/error state */}
				{isLoading ? (
					<box paddingX={1} marginBottom={1} flexDirection="column">
						<text fg={theme.colors.text.muted}>Asking Claude...</text>
						<text fg={theme.colors.text.secondary}>
							Generating parameters and constraints...
						</text>
					</box>
				) : (
					<>
						<box paddingX={1} marginBottom={1} flexDirection="column">
							<text fg={theme.colors.text.secondary}>
								Describe your test scenario:
							</text>
						</box>

						<box paddingX={1} marginBottom={1}>
							<textarea
								key={textareaKey}
								ref={textareaRef}
								placeholder="Login form with email, password, remember me checkbox..."
								wrapMode="word"
								height={7}
								focused
								flexGrow={1}
							/>
						</box>

						<box paddingX={1} marginBottom={1}>
							<text fg={theme.colors.text.muted}>
								Tip: paste a feature spec, user story, or brief description.
							</text>
						</box>
					</>
				)}

				{/* Error message */}
				{error !== "" && (
					<box paddingX={1} marginBottom={1}>
						<text fg={theme.colors.status.error}>✗ {error}</text>
					</box>
				)}

				{/* Hints */}
				<box paddingX={1} marginTop={1}>
					{isLoading ? (
						<text fg={theme.colors.text.muted}>Please wait...</text>
					) : (
						<text>
							<span fg={theme.colors.accent}>[Ctrl+G]</span>
							<span fg={theme.colors.text.secondary}> Generate</span>
							<span fg={theme.colors.text.muted}> </span>
							<span fg={theme.colors.accent}>[F2]</span>
							<span fg={theme.colors.text.secondary}> Setup</span>
							<span fg={theme.colors.text.muted}> </span>
							<span fg={theme.colors.accent}>[Esc]</span>
							<span fg={theme.colors.text.secondary}> Cancel</span>
						</text>
					)}
				</box>
			</box>
		</box>
	);
}
