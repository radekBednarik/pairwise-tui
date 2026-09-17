import { TAB_OPTIONS } from "../constants";
import { useTheme } from "../theme/ThemeContext";
import { AnimatedLogo } from "./AnimatedLogo";

interface HeaderProps {
	activeTab: number;
}

export function Header({ activeTab }: HeaderProps) {
	const theme = useTheme();

	return (
		<box
			flexDirection="column"
			backgroundColor={theme.colors.bg.header}
			paddingX={2}
			flexShrink={0}
		>
			<box flexDirection="row" alignItems="center" gap={1} paddingY={1}>
				<AnimatedLogo />
				<ascii-font
					text="Pairwise TUI"
					font="tiny"
					color={theme.colors.accent}
				/>
			</box>
			<box flexDirection="row" gap={1}>
				{TAB_OPTIONS.map((tab, i) => (
					<box
						key={tab.name}
						backgroundColor={
							activeTab === i
								? theme.colors.bg.selected
								: theme.colors.bg.header
						}
						paddingX={1}
					>
						<text
							fg={
								activeTab === i
									? theme.colors.text.primary
									: theme.colors.text.disabled
							}
						>
							{`${i + 1}:${tab.name}`}
						</text>
					</box>
				))}
			</box>
		</box>
	);
}
