import { createContext, useContext } from "react";
import { tokyonightDark } from "./themes";
import type { Theme } from "./types";

interface ThemeContextValue {
	theme: Theme;
	themeName: string;
	setThemeName: (name: string) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
	theme: tokyonightDark,
	themeName: "tokyonight-dark",
	setThemeName: () => {},
});

export function useTheme(): Theme {
	return useContext(ThemeContext).theme;
}
