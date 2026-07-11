import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext";

// Number of steps per ramp; the pulse ramps up then down for a breathing cycle.
const STEPS = 8;
const TICK_MS = 90;

/** Linearly interpolate two `#rrggbb` colors, returning `#rrggbb`. */
function hexLerp(a: string, b: string, t: number): string {
	const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
	const parse = (hex: string) => {
		const n = Number.parseInt(hex.slice(1), 16);
		return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const;
	};
	const [ar, ag, ab] = parse(a);
	const [br, bg, bb] = parse(b);
	const to = (x: number) => x.toString(16).padStart(2, "0");
	return `#${to(clamp(ar + (br - ar) * t))}${to(clamp(ag + (bg - ag) * t))}${to(
		clamp(ab + (bb - ab) * t),
	)}`;
}

// Grid cell positions, mirroring the app icon's 3x3 X pattern.
const ROWS = [0, 1, 2] as const;
const COLS = [0, 1, 2] as const;

/**
 * Animated 3x3 grid logo echoing the Windows app icon: the X (both diagonals)
 * carries the theme's logo colors and gently pulses/breathes, while the edge
 * cells stay dim and counter-pulse subtly so the X remains the dominant shape.
 */
export function AnimatedLogo() {
	const theme = useTheme();
	const [tick, setTick] = useState(0);

	useEffect(() => {
		const id = setInterval(
			() => setTick((t) => (t + 1) % (STEPS * 2)),
			TICK_MS,
		);
		return () => clearInterval(id);
	}, []);

	// Triangle wave: 0 -> 1 -> 0 for a smooth breathing pulse.
	const phase = tick <= STEPS ? tick / STEPS : (2 * STEPS - tick) / STEPS;

	const { primary, secondary } = theme.colors.logo;
	const dim = theme.colors.border.inactive;

	const cellColor = (row: number, col: number): string => {
		if (row === col) return hexLerp(dim, primary, phase); // main diagonal + center
		if (row + col === 2) return hexLerp(dim, secondary, phase); // anti-diagonal corners
		return hexLerp(dim, secondary, (1 - phase) * 0.5); // edge cells, subdued counter-pulse
	};

	return (
		<box flexDirection="column">
			{ROWS.map((row) => (
				<box key={row} flexDirection="row" gap={1}>
					{COLS.map((col) => (
						<text key={col} fg={cellColor(row, col)}>
							██
						</text>
					))}
				</box>
			))}
		</box>
	);
}
