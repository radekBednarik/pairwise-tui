import { useEffect, useState } from "react";

const FRAMES = [
	"┌─┬─┐\n│█│░│\n└─┴─┘",
	"┌─┬─┐\n│░│█│\n└─┴─┘",
	"╔═╦═╗\n║░║█║\n╚═╩═╝",
	"╔═╦═╗\n║█║░║\n╚═╩═╝",
] as const;

const COLORS = ["#5fafff", "#af5fff", "#5fafff", "#af5fff"] as const;

export function AnimatedLogo() {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 180);
		return () => clearInterval(id);
	}, []);

	return <text fg={COLORS[frame]}>{FRAMES[frame]}</text>;
}
