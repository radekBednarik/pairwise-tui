import { randomBytes } from "node:crypto";
import { open, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { IS_RELEASE_BUILD } from "./version";

export type InstallKind = "linux" | "windows" | "appimage";

export type Availability =
	| "ok"
	| "source-run"
	| "unsupported-platform"
	| "read-only";

export interface ResolvedInstall {
	kind: InstallKind | null;
	/** The file an update replaces. Empty when `kind` is null. */
	targetPath: string;
	/** The release asset matching `kind`. Empty when `kind` is null. */
	assetName: string;
	availability: Availability;
}

export interface InstallContext extends ResolvedInstall {
	/** Identity of the target at startup, to notice a moved or replaced file. */
	identity: string | null;
}

export interface ResolveInstallOptions {
	platform: NodeJS.Platform;
	arch: string;
	env: Record<string, string | undefined>;
	execPath: string;
	isReleaseBuild: boolean;
}

const ASSET_NAMES: Record<InstallKind, string> = {
	linux: "pairwise-tui",
	windows: "pairwise-tui.exe",
	appimage: "Pairwise-TUI-x86_64.AppImage",
};

function unavailable(availability: Availability): ResolvedInstall {
	return { kind: null, targetPath: "", assetName: "", availability };
}

function install(kind: InstallKind, targetPath: string): ResolvedInstall {
	return {
		kind,
		targetPath,
		assetName: ASSET_NAMES[kind],
		availability: "ok",
	};
}

/**
 * Decides which file an update would replace.
 *
 * `APPIMAGE` is inherited by child processes, so on its own it proves
 * nothing: a plain build started from a terminal emulator that is itself an
 * AppImage would see that emulator's path. Only when the running executable
 * lives inside `APPDIR` is this process really the AppImage's payload.
 */
export function resolveInstallContext(
	options: ResolveInstallOptions,
): ResolvedInstall {
	const { platform, arch, env, execPath, isReleaseBuild } = options;
	if (!isReleaseBuild) return unavailable("source-run");
	if (arch !== "x64") return unavailable("unsupported-platform");
	if (platform === "win32") return install("windows", execPath);
	if (platform !== "linux") return unavailable("unsupported-platform");

	const appImage = env.APPIMAGE;
	const appDir = env.APPDIR;
	if (appImage && appDir) {
		const root = appDir.endsWith("/") ? appDir : `${appDir}/`;
		if (execPath.startsWith(root)) return install("appimage", appImage);
	}
	return install("linux", execPath);
}

/**
 * Whether files can be created in `dir`. An actual write is the only answer
 * that holds on both systems: `access()` ignores ACLs on Windows.
 */
export async function probeWritable(dir: string): Promise<boolean> {
	const probe = join(
		dir,
		`.pairwise-tui-probe-${process.pid}-${randomBytes(6).toString("hex")}`,
	);
	try {
		// "wx": fail rather than follow or truncate something already there.
		const handle = await open(probe, "wx", 0o600);
		await handle.close();
	} catch {
		return false;
	}
	await unlink(probe).catch(() => {});
	return true;
}

export async function fileIdentity(path: string): Promise<string | null> {
	try {
		const s = await stat(path);
		return `${s.dev}:${s.ino}`;
	} catch {
		return null;
	}
}

let cached: Promise<InstallContext> | null = null;

/** The install context of this process, resolved once. */
export function getInstallContext(): Promise<InstallContext> {
	cached ??= (async () => {
		const resolved = resolveInstallContext({
			platform: process.platform,
			arch: process.arch,
			env: process.env,
			execPath: process.execPath,
			isReleaseBuild: IS_RELEASE_BUILD,
		});
		if (resolved.kind === null) return { ...resolved, identity: null };
		const identity = await fileIdentity(resolved.targetPath);
		const writable = await probeWritable(dirname(resolved.targetPath));
		return {
			...resolved,
			identity,
			availability: writable ? "ok" : "read-only",
		};
	})();
	return cached;
}
