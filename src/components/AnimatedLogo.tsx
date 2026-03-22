import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext";

const FRAMES = [
	"┌─┬─┐\n│█│░│\n└─┴─┘",
	"┌─┬─┐\n│░│█│\n└─┴─┘",
	"╔═╦═╗\n║░║█║\n╚═╩═╝",
	"╔═╦═╗\n║█║░║\n╚═╩═╝",
] as const;

export function AnimatedLogo() {
	const theme = useTheme();
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 180);
		return () => clearInterval(id);
	}, []);

	const color =
		frame % 2 === 0 ? theme.colors.logo.primary : theme.colors.logo.secondary;

	return <text fg={color}>{FRAMES[frame]}</text>;
}
