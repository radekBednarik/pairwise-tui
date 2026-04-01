import { homedir } from "node:os";
import { join } from "node:path";

export function getAppConfigPath(filename: string): string {
	if (process.platform === "win32") {
		const appData =
			process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
		return join(appData, "pairwise-tui", filename);
	}
	const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
	return join(xdgConfig, "pairwise-tui", filename);
}
