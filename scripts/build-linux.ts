import { mkdir } from "node:fs/promises";
import { buildDefines, COMPILE_HARDENING } from "./build-common";

await mkdir("./dist", { recursive: true });

console.log("Building Linux x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	define: buildDefines(),
	compile: { ...COMPILE_HARDENING, outfile: "dist/pairwise-tui" },
});
console.log("✓ dist/pairwise-tui");
