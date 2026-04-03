import { mkdir } from "node:fs/promises";

await mkdir("./dist", { recursive: true });

console.log("Building Windows x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	compile: {
		target: "bun-windows-x64",
		outfile: "dist/pairwise-tui.exe",
		windows: {
			icon: "./assets/icon/pairwise-tui.ico",
			title: "Pairwise TUI",
			description: "Terminal UI for generating PICT pairwise test cases",
		},
	},
});
console.log("✓ dist/pairwise-tui.exe");
