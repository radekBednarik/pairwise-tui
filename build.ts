import { mkdir } from "node:fs/promises";

await mkdir("./dist", { recursive: true });

console.log("Building Linux x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	compile: { outfile: "dist/pairwise-tui" },
});
console.log("✓ dist/pairwise-tui");

// Windows x64 — requires the win32 native package to be present on the build machine
console.log("\nInstalling @opentui/core-win32-x64 for cross-compilation...");
const install = Bun.spawnSync([
	"npm",
	"install",
	"@opentui/core-win32-x64@0.1.88",
	"--force",
	"--no-save",
	"--ignore-scripts",
	"--prefer-offline",
]);
if (install.exitCode !== 0) {
	console.error(
		"Failed to install Windows native package:",
		install.stderr.toString(),
	);
	process.exit(1);
}

console.log("Building Windows x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	compile: { target: "bun-windows-x64", outfile: "dist/pairwise-tui.exe" },
});
console.log("✓ dist/pairwise-tui.exe");

console.log("\nBuild complete!");
