import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmod, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileIdentity, probeWritable, resolveInstallContext } from "./platform";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pairwise-update-platform-"));
});

afterEach(async () => {
	await chmod(dir, 0o700).catch(() => {});
	await rm(dir, { recursive: true, force: true });
});

const base = {
	platform: "linux" as NodeJS.Platform,
	arch: "x64",
	env: {} as Record<string, string | undefined>,
	execPath: "/home/u/bin/pairwise-tui",
	isReleaseBuild: true,
};

test("a source run is unavailable", () => {
	const ctx = resolveInstallContext({ ...base, isReleaseBuild: false });
	expect(ctx.availability).toBe("source-run");
	expect(ctx.kind).toBeNull();
});

test("linux x64 targets the running executable", () => {
	expect(resolveInstallContext(base)).toEqual({
		kind: "linux",
		targetPath: "/home/u/bin/pairwise-tui",
		assetName: "pairwise-tui",
		availability: "ok",
	});
});

test("windows x64 targets the running exe", () => {
	expect(
		resolveInstallContext({
			...base,
			platform: "win32",
			execPath: "C:\\Tools\\pairwise-tui.exe",
		}),
	).toEqual({
		kind: "windows",
		targetPath: "C:\\Tools\\pairwise-tui.exe",
		assetName: "pairwise-tui.exe",
		availability: "ok",
	});
});

test("an AppImage targets the AppImage file", () => {
	expect(
		resolveInstallContext({
			...base,
			env: {
				APPIMAGE: "/home/u/Apps/Pairwise-TUI-x86_64.AppImage",
				APPDIR: "/tmp/.mount_PairwiAbCd",
			},
			execPath: "/tmp/.mount_PairwiAbCd/usr/bin/pairwise-tui",
		}),
	).toEqual({
		kind: "appimage",
		targetPath: "/home/u/Apps/Pairwise-TUI-x86_64.AppImage",
		assetName: "Pairwise-TUI-x86_64.AppImage",
		availability: "ok",
	});
});

test("an inherited APPIMAGE variable never redirects the target", () => {
	// A plain build started from a terminal emulator that is itself an AppImage.
	const outside = resolveInstallContext({
		...base,
		env: {
			APPIMAGE: "/home/u/Apps/SomeTerminal.AppImage",
			APPDIR: "/tmp/.mount_SomeTeXyZ",
		},
	});
	expect(outside.kind).toBe("linux");
	expect(outside.targetPath).toBe("/home/u/bin/pairwise-tui");

	const noAppDir = resolveInstallContext({
		...base,
		env: { APPIMAGE: "/home/u/Apps/SomeTerminal.AppImage" },
	});
	expect(noAppDir.kind).toBe("linux");

	// A sibling directory sharing the prefix is still outside.
	const prefixTrick = resolveInstallContext({
		...base,
		env: { APPIMAGE: "/x.AppImage", APPDIR: "/tmp/.mount_A" },
		execPath: "/tmp/.mount_AB/usr/bin/pairwise-tui",
	});
	expect(prefixTrick.kind).toBe("linux");
});

test("other platforms and architectures are unsupported", () => {
	for (const over of [
		{ platform: "darwin" as NodeJS.Platform },
		{ arch: "arm64" },
		{ platform: "win32" as NodeJS.Platform, arch: "arm64" },
	]) {
		const ctx = resolveInstallContext({ ...base, ...over });
		expect(ctx.availability).toBe("unsupported-platform");
		expect(ctx.kind).toBeNull();
	}
});

test("probeWritable is true for a writable directory and leaves nothing", async () => {
	expect(await probeWritable(dir)).toBe(true);
	expect(await readdir(dir)).toEqual([]);
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
	"probeWritable is false for a read-only directory",
	async () => {
		await chmod(dir, 0o500);
		expect(await probeWritable(dir)).toBe(false);
	},
);

test("probeWritable is false for a missing directory", async () => {
	expect(await probeWritable(join(dir, "nope"))).toBe(false);
});

test("fileIdentity is stable for one file and changes when it is replaced", async () => {
	const file = join(dir, "app");
	await Bun.write(file, "old");
	const first = await fileIdentity(file);
	expect(first).not.toBeNull();
	expect(await fileIdentity(file)).toBe(first);

	await Bun.write(join(dir, "other"), "new");
	await rename(join(dir, "other"), file);
	expect(await fileIdentity(file)).not.toBe(first);
});

test("fileIdentity is null for a missing file", async () => {
	expect(await fileIdentity(join(dir, "missing"))).toBeNull();
});
