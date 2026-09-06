import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getAppConfigPath } from "../utils/configPath";

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

function getCredentialsPath(): string {
	return getAppConfigPath("credentials.json");
}

// The API key must never exist on disk in a world-readable state, so it is
// written to a fresh private file and renamed into place. The rename also
// replaces — rather than writes through — anything already at the target,
// including a symlink planted there by another user.
async function writePrivateFile(path: string, content: string): Promise<void> {
	const dir = dirname(path);
	await mkdir(dir, { recursive: true, mode: DIR_MODE });
	const tmpPath = `${path}.${randomUUID()}.tmp`;
	try {
		await writeFile(tmpPath, content, { mode: FILE_MODE, flag: "wx" });
		await rename(tmpPath, path);
	} catch (err) {
		await unlink(tmpPath).catch(() => {});
		throw err;
	}
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
	await writePrivateFile(
		getCredentialsPath(),
		JSON.stringify({ anthropic: { apiKey } }, null, 2),
	);
}

export async function clearApiKey(): Promise<void> {
	const path = getCredentialsPath();
	let parsed: Record<string, unknown> = {};

	try {
		const value = JSON.parse(await Bun.file(path).text());
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			parsed = value as Record<string, unknown>;
		}
	} catch {
		// No credentials file at all — there is nothing to clear. Anything else
		// (unparseable JSON) is still overwritten below, so a key cannot survive
		// inside a damaged file.
		if (!(await Bun.file(path).exists())) return;
	}

	delete parsed.anthropic;
	// A failure here must reach the caller: reporting a cleared key that is
	// still on disk is worse than reporting the error.
	await writePrivateFile(path, JSON.stringify(parsed, null, 2));
}
