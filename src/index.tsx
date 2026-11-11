import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./App";
import { getInstallContext } from "./update/platform";
import { restartInto } from "./update/restart";
import { runStartupTasks } from "./update/startup";

// Before any interface exists: clear what an interrupted update left behind
// and, if the user had agreed to an update that was downloaded and verified
// but never installed (terminal closed, process killed), install it now.
// Neither call throws; a failure only means this version keeps running.
const context = await getInstallContext();
const startup = await runStartupTasks({ context });

if (startup.restartVersion !== null && context.kind !== null) {
	// No renderer was created, so the terminal is untouched: hand it straight
	// to the version that was just installed.
	process.exitCode = await restartInto({
		kind: context.kind,
		target: context.targetPath,
		version: startup.restartVersion,
	});
} else {
	const renderer = await createCliRenderer({ exitOnCtrlC: false });
	createRoot(renderer).render(<App startupMessage={startup.reason} />);
}
