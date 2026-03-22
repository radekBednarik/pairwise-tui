import type { Theme } from "./types";

export const tokyonightDark: Theme = {
	name: "tokyonight-dark",
	colors: {
		accent: "#7aa2f7",
		text: {
			primary: "#c0caf5",
			secondary: "#a9b1d6",
			muted: "#565f89",
			disabled: "#3b4261",
		},
		bg: {
			canvas: "#0d0e17",
			header: "#16161e",
			panel: "#1a1b26",
			base: "#1f2335",
			elevated: "#24283b",
			selected: "#364a82",
		},
		border: { active: "#7aa2f7", inactive: "#3b4261" },
		status: {
			success: "#9ece6a",
			successBg: "#1a2310",
			error: "#f7768e",
			errorBg: "#2a1020",
		},
		value: "#73daca",
		logo: { primary: "#7aa2f7", secondary: "#bb9af7" },
	},
};

export const tokyonightStorm: Theme = {
	name: "tokyonight-storm",
	colors: {
		accent: "#7aa2f7",
		text: {
			primary: "#c0caf5",
			secondary: "#a9b1d6",
			muted: "#565f89",
			disabled: "#414868",
		},
		bg: {
			canvas: "#1a1b26",
			header: "#1f2335",
			panel: "#24283b",
			base: "#2f3549",
			elevated: "#3b4261",
			selected: "#364a82",
		},
		border: { active: "#7aa2f7", inactive: "#414868" },
		status: {
			success: "#9ece6a",
			successBg: "#1a2310",
			error: "#f7768e",
			errorBg: "#2a1020",
		},
		value: "#73daca",
		logo: { primary: "#2ac3de", secondary: "#bb9af7" },
	},
};

export const catppuccinMocha: Theme = {
	name: "catppuccin-mocha",
	colors: {
		accent: "#89b4fa",
		text: {
			primary: "#cdd6f4",
			secondary: "#bac2de",
			muted: "#6c7086",
			disabled: "#585b70",
		},
		bg: {
			canvas: "#11111b",
			header: "#181825",
			panel: "#1e1e2e",
			base: "#313244",
			elevated: "#45475a",
			selected: "#585b70",
		},
		border: { active: "#89b4fa", inactive: "#45475a" },
		status: {
			success: "#a6e3a1",
			successBg: "#1a2310",
			error: "#f38ba8",
			errorBg: "#2a1020",
		},
		value: "#94e2d5",
		logo: { primary: "#89b4fa", secondary: "#cba6f7" },
	},
};

export const THEMES: Record<string, Theme> = {
	"tokyonight-dark": tokyonightDark,
	"tokyonight-storm": tokyonightStorm,
	"catppuccin-mocha": catppuccinMocha,
};

export const THEME_NAMES = Object.keys(THEMES);
export const DEFAULT_THEME_NAME = "tokyonight-dark";
