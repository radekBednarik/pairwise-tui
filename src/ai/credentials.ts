import { chmod, mkdir } from "node:fs/promises";
import { getAppConfigPath } from "../utils/configPath";

function getCredentialsPath(): string {
	return getAppConfigPath("credentials.json");
}

export async function loadApiKey(): Promise<string | null> {
	// Environment variable takes precedence
	if (process.env.ANTHROPIC_API_KEY) {
		return process.env.ANTHROPIC_API_KEY;
	}
	try {
		const text = await Bun.file(getCredentialsPath()).text();
		const parsed = JSON.parse(text);
		const key = parsed?.anthropic?.apiKey;
		return typeof key === "string" && key.length > 0 ? key : null;
	} catch {
		return null;
	}
}

export async function saveApiKey(apiKey: string): Promise<void> {
	const path = getCredentialsPath();
	const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	const dir = path.substring(0, lastSep);
	await mkdir(dir, { recursive: true });
	await Bun.write(path, JSON.stringify({ anthropic: { apiKey } }, null, 2));
	if (process.platform !== "win32") {
		await chmod(path, 0o600);
	}
}

export async function clearApiKey(): Promise<void> {
	try {
		const path = getCredentialsPath();
		const text = await Bun.file(path).text();
		const parsed = JSON.parse(text);
		delete parsed.anthropic;
		await Bun.write(path, JSON.stringify(parsed, null, 2));
	} catch {
		// File doesn't exist or can't be parsed — nothing to clear
	}
}
