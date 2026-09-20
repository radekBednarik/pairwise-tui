import { expect, test } from "bun:test";
import { useState } from "react";
import { renderTest } from "../testing/render";
import type { PictModel } from "../types";
import { type ModelTabState, useModelTabState } from "./useModelTabState";

function Probe({ expose }: { expose: (s: ModelTabState) => void }) {
	const [model, setModel] = useState<PictModel>({
		parameters: [{ name: "OS", values: ["a", "b"] }],
		submodels: [],
		constraints: "",
	});
	expose(useModelTabState(model, setModel));
	return <text>probe</text>;
}

async function renderProbe() {
	let state: ModelTabState | null = null;
	const t = await renderTest(
		<Probe
			expose={(s) => {
				state = s;
			}}
		/>,
		{ width: 20, height: 3 },
	);
	return {
		state: () => {
			if (!state) throw new Error("hook not rendered");
			return state;
		},
		flush: () => t.flush(),
		cleanup: () => t.renderer.destroy(),
	};
}

test("stopEditing returns an add-param edit to the params panel", async () => {
	const p = await renderProbe();
	try {
		p.state().setActivePanel("adding");
		await p.flush();
		expect(p.state().activePanel).toBe("adding");
		p.state().stopEditing();
		await p.flush();
		expect(p.state().activePanel).toBe("params");
	} finally {
		p.cleanup();
	}
});

test("stopEditing returns a sub-model edit to the sub-model list, like Escape does", async () => {
	const p = await renderProbe();
	try {
		p.state().startAddSubmodel();
		await p.flush();
		expect(p.state().activePanel).toBe("submodel-adding");
		p.state().stopEditing();
		await p.flush();
		expect(p.state().activePanel).toBe("submodels");
	} finally {
		p.cleanup();
	}
});

test("stopEditing keeps a non-editing panel", async () => {
	const p = await renderProbe();
	try {
		p.state().setActivePanel("submodels");
		await p.flush();
		p.state().stopEditing();
		await p.flush();
		expect(p.state().activePanel).toBe("submodels");
	} finally {
		p.cleanup();
	}
});
