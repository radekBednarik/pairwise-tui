import {
	createTestRenderer,
	type TestRendererOptions,
} from "@opentui/core/testing";
import { createRoot, type Root } from "@opentui/react";
import type { ReactNode } from "react";

/**
 * Renders a React element into a headless OpenTUI renderer and starts the
 * render loop, so state updates take effect on the next `flush()`.
 *
 * This deliberately does not use `testRender` from `@opentui/react/test-utils`.
 * That helper switches React into "act environment" mode, wraps only the
 * initial render in `act()` and leaves the flag on. Our tests never drive
 * React through `act()`: they feed keys through `mockInput` and let the real
 * render loop commit the resulting state, the same way the running app does.
 * With the flag on, React reports every such update as "not wrapped in
 * act(...)", including the textarea's mount-time `contentChange` that fires
 * after `act()` has already returned. Rendering through `createRoot` directly
 * keeps React in its normal mode, where those updates are expected.
 */
export async function renderTest(
	node: ReactNode,
	options: TestRendererOptions,
) {
	let root: Root | null = null;
	const t = await createTestRenderer({
		...options,
		onDestroy() {
			root?.unmount();
			root = null;
			options.onDestroy?.();
		},
	});
	root = createRoot(t.renderer);
	root.render(node);
	await t.flush();
	t.renderer.start();
	await t.flush();
	return t;
}
