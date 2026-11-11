import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// FR-030: no update step may ask for administrator rights. The updater has
// exactly one place that starts a process (the Windows restart of the app's
// own file), and nothing that could raise privileges. This keeps it that way.
const ELEVATION = [
	/\bsudo\b/i,
	/\bpkexec\b/i,
	/\bdoas\b/i,
	/\brunas\b/i,
	/\bgsudo\b/i,
	/ShellExecute/i,
	/Start-Process/i,
	/requireAdministrator/i,
	/\bsetuid\b/i,
];

async function sources(): Promise<Array<{ name: string; text: string }>> {
	const dir = import.meta.dir;
	const names = (await readdir(dir)).filter(
		(name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
	);
	return Promise.all(
		names.map(async (name) => ({
			name,
			text: await Bun.file(join(dir, name)).text(),
		})),
	);
}

test("the updater contains nothing that asks for elevated rights", async () => {
	const files = await sources();
	expect(files.length).toBeGreaterThan(8);
	for (const { name, text } of files) {
		for (const pattern of ELEVATION) {
			expect(`${name}: ${pattern.test(text)}`).toBe(`${name}: false`);
		}
	}
});

test("the updater starts a process in one place only, and never through a shell", async () => {
	const files = await sources();
	const spawning = files
		.filter(({ text }) =>
			/Bun\.spawn|child_process|Bun\.\$|\bexecSync\b/.test(text),
		)
		.map(({ name }) => name);
	expect(spawning).toEqual(["restart.ts"]);
	const restart = files.find(({ name }) => name === "restart.ts")?.text ?? "";
	expect(restart).not.toMatch(
		/child_process|Bun\.\$|shell:\s*true|cmd\.exe|\/bin\/sh/,
	);
});
