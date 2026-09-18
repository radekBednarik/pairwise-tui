import { useTheme } from "../theme/ThemeContext";

interface StatusMessageProps {
	status: string;
	statusIsError: boolean;
}

export function StatusMessage({ status, statusIsError }: StatusMessageProps) {
	const theme = useTheme();

	if (status === "") return null;

	return (
		<box
			paddingX={2}
			backgroundColor={
				statusIsError
					? theme.colors.status.errorBg
					: theme.colors.status.successBg
			}
		>
			<text
				fg={
					statusIsError
						? theme.colors.status.error
						: theme.colors.status.success
				}
			>
				{status}
			</text>
		</box>
	);
}
