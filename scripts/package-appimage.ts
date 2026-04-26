import { chmod, copyFile, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";

const distDir = "./dist";
const appDir = join(distDir, "PairwiseTUI.AppDir");
const binaryPath = join(distDir, "pairwise-tui");
const iconPath = "./assets/icon/pairwise-tui.png";
const desktopFilePath = "./assets/linux/pairwise-tui.desktop";
const appRunPath = "./assets/linux/AppRun";
const appImageToolPath =
	process.env.APPIMAGETOOL ?? join(distDir, "appimagetool.AppImage");
const runtimeFile = process.env.APPIMAGE_RUNTIME_FILE;
const outputPath = join(distDir, "Pairwise-TUI-x86_64.AppImage");

await rm(appDir, { force: true, recursive: true });
await mkdir(join(appDir, "usr/bin"), { recursive: true });

await copyFile(binaryPath, join(appDir, "usr/bin/pairwise-tui"));
await copyFile(iconPath, join(appDir, basename(iconPath)));
await copyFile(desktopFilePath, join(appDir, "pairwise-tui.desktop"));
await copyFile(appRunPath, join(appDir, "AppRun"));

await chmod(join(appDir, "usr/bin/pairwise-tui"), 0o755);
await chmod(join(appDir, "AppRun"), 0o755);
await chmod(appImageToolPath, 0o755);

const packaged = Bun.spawnSync(
	[
		appImageToolPath,
		"--no-appstream",
		...(runtimeFile ? ["--runtime-file", runtimeFile] : []),
		appDir,
		outputPath,
	],
	{
		stdout: "inherit",
		stderr: "inherit",
		env: {
			...process.env,
			ARCH: "x86_64",
		},
	},
);

if (packaged.exitCode !== 0) {
	process.exit(packaged.exitCode ?? 1);
}

console.log(`✓ ${outputPath}`);
