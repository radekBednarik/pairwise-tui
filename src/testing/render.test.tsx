import { expect, test } from "bun:test";
import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { renderTest } from "./render";

function Counter() {
	const [count, setCount] = useState(0);
	useKeyboard((key) => {
		if (key.name === "k") setCount((c) => c + 1);
	});
	return <text>count {count}</text>;
}

test("state updates driven by mock input do not trigger React act() warnings", async () => {
	const errors: string[] = [];
	const realError = console.error;
	console.error = (...args: unknown[]) => {
		errors.push(args.map(String).join(" "));
	};
	const t = await renderTest(<Counter />, { width: 20, height: 3 });
	try {
		t.mockInput.pressKey("k");
		await t.flush();
		t.mockInput.pressKey("k");
		await t.flush();

		expect(t.captureCharFrame()).toContain("count 2");
		expect(errors.filter((e) => e.includes("act("))).toEqual([]);
	} finally {
		console.error = realError;
		t.renderer.destroy();
	}
});
