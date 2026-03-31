import { useTheme } from "../theme/ThemeContext";

interface AiSetupOverlayProps {
	currentKey: string | null;
	inputValue: string;
	onInputChange: (value: string) => void;
	onSubmit: () => void;
}

export function AiSetupOverlay({
	currentKey,
	inputValue,
	onInputChange,
	onSubmit,
}: AiSetupOverlayProps) {
	const theme = useTheme();
	const isConfigured = currentKey !== null;
	const maskedKey = currentKey ? `${currentKey.slice(0, 10)}...` : null;

	const hints = [
		{ key: "Enter", label: " Save" },
		...(isConfigured ? [{ key: "d", label: " Clear key" }] : []),
		{ key: "Esc", label: " Close" },
	];

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
				width={62}
				flexDirection="column"
				padding={1}
			>
				{/* Title */}
				<box paddingX={1} marginBottom={1}>
					<text>
						<span fg={theme.colors.accent}>AI Setup</span>
						<span fg={theme.colors.text.muted}> — Anthropic API Key</span>
					</text>
				</box>

				{/* Status */}
				<box paddingX={1} marginBottom={1}>
					{isConfigured ? (
						<text fg={theme.colors.status.success}>
							✓ API key configured ({maskedKey})
						</text>
					) : (
						<text fg={theme.colors.text.muted}>No API key configured</text>
					)}
				</box>

				{/* Instructions */}
				<box paddingX={1} marginBottom={1} flexDirection="column">
					<text fg={theme.colors.text.secondary}>
						Get your key at console.anthropic.com
					</text>
					<text fg={theme.colors.text.secondary}>
						Pro/Max plan subscribers have API access included.
					</text>
				</box>

				{/* Input */}
				<box
					paddingX={1}
					flexDirection="row"
					alignItems="center"
					marginBottom={1}
				>
					<text fg={theme.colors.text.secondary}>New key: </text>
					<input
						value={inputValue}
						onChange={onInputChange}
						onSubmit={onSubmit}
						placeholder="sk-ant-..."
						width={44}
						focused
						textColor={theme.colors.text.primary}
						backgroundColor={theme.colors.bg.elevated}
						cursorColor={theme.colors.accent}
						placeholderColor={theme.colors.text.muted}
					/>
				</box>

				{/* Hints */}
				<box paddingX={1} marginTop={1}>
					<text>
						{hints.map((h, i) => (
							<span key={h.key}>
								{i > 0 && <span fg={theme.colors.text.muted}> </span>}
								<span fg={theme.colors.accent}>[{h.key}]</span>
								<span fg={theme.colors.text.secondary}>{h.label}</span>
							</span>
						))}
					</text>
				</box>
			</box>
		</box>
	);
}
