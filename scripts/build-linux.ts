import { mkdir } from "node:fs/promises";
import { buildDefines } from "./build-common";

await mkdir("./dist", { recursive: true });

console.log("Building Linux x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	define: buildDefines(),
	compile: { outfile: "dist/pairwise-tui" },
});
console.log("✓ dist/pairwise-tui");
