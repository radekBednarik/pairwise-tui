import { expect, test } from "bun:test";
import { renderTest } from "../testing/render";
import { useDeferredScreenChange } from "./useDeferredScreenChange";

type Request = ReturnType<typeof useDeferredScreenChange>;

function Probe({
	canOpen,
	expose,
}: {
	canOpen: boolean;
	expose: (request: Request) => void;
}) {
	expose(useDeferredScreenChange(canOpen));
	return <text>probe</text>;
}

async function renderProbe(canOpen: boolean) {
	let request: Request = () => {};
	const t = await renderTest(
		<Probe
			canOpen={canOpen}
			expose={(r) => {
				request = r;
			}}
		/>,
		{ width: 20, height: 3 },
	);
	const events: string[] = [];
	return {
		events,
		request: (name: string) =>
			request(
				() => events.push(`open ${name}`),
				() => events.push(`drop ${name}`),
			),
		flush: () => t.flush(),
		cleanup: () => t.renderer.destroy(),
	};
}

test("a single request is applied once the screen may change", async () => {
	const p = await renderProbe(true);
	try {
		p.request("picker");
		await p.flush();
		await p.flush();
		expect(p.events).toEqual(["open picker"]);
	} finally {
		p.cleanup();
	}
});

test("a request made while the screen may not change is dropped with feedback, not replayed", async () => {
	const p = await renderProbe(false);
	try {
		p.request("picker");
		await p.flush();
		await p.flush();
		expect(p.events).toEqual(["drop picker"]);
	} finally {
		p.cleanup();
	}
});

test("two requests in one batch perform the first and report the second as dropped", async () => {
	const p = await renderProbe(true);
	try {
		p.request("picker");
		p.request("save dialog");
		await p.flush();
		await p.flush();
		// The second would open beneath the first, so it is dropped like any
		// request that finds an overlay already on top - and says so.
		expect(p.events).toEqual(["open picker", "drop save dialog"]);
	} finally {
		p.cleanup();
	}
});
