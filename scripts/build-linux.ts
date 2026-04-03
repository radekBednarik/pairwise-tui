import { mkdir } from "node:fs/promises";

await mkdir("./dist", { recursive: true });

console.log("Building Linux x64...");
await Bun.build({
	entrypoints: ["./src/index.tsx"],
	compile: { outfile: "dist/pairwise-tui" },
});
console.log("✓ dist/pairwise-tui");
