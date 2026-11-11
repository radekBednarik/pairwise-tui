import { mkdir } from "node:fs/promises";
import pkg from "../package.json";
import { buildDefines, COMPILE_HARDENING } from "./build-common";

await mkdir("./dist", { recursive: true });

console.log("Building Windows x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	define: buildDefines(),
	compile: {
		...COMPILE_HARDENING,
		target: "bun-windows-x64",
		outfile: "dist/pairwise-tui.exe",
		windows: {
			icon: "./assets/icon/pairwise-tui.ico",
			title: "Pairwise TUI",
			description: "Terminal UI for generating PICT pairwise test cases",
			publisher: "Radek Bednarik",
			copyright: "MIT",
			version: pkg.version,
		},
	},
});
console.log("✓ dist/pairwise-tui.exe");
