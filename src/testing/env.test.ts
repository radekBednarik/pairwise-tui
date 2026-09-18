import { expect, test } from "bun:test";
import { overrideEnv } from "./env";

test("a variable that was unset is unset again after restore, not 'undefined'", () => {
	const name = "PAIRWISE_TUI_TEST_UNSET";
	delete process.env[name];
	const restore = overrideEnv({ [name]: "x" });
	expect(process.env[name]).toBe("x");
	restore();
	expect(name in process.env).toBe(false);
});

test("a variable that was set gets its previous value back", () => {
	const name = "PAIRWISE_TUI_TEST_SET";
	process.env[name] = "before";
	const restore = overrideEnv({ [name]: "during" });
	expect(process.env[name]).toBe("during");
	restore();
	expect(process.env[name]).toBe("before");
	delete process.env[name];
});
