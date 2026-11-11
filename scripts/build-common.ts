/**
 * Compile-time constants shared by the Linux and Windows builds.
 *
 * `__RELEASE_BUILD__` marks a compiled artifact: without it (running from
 * source) the updater is inert, because there `process.execPath` is the Bun
 * runtime and must never be replaced.
 *
 * `UPDATE_SOURCE_OVERRIDE` bakes a different release source into the build.
 * It exists only for the manual test rig (specs/002-auto-update/quickstart.md).
 * A build made without it contains the GitHub addresses only, and nothing at
 * runtime can change them. The release workflow refuses to run with it set.
 */
export function buildDefines(): Record<string, string> {
	const defines: Record<string, string> = { __RELEASE_BUILD__: "true" };
	const override = process.env.UPDATE_SOURCE_OVERRIDE;
	if (override) {
		console.warn(
			`⚠ UPDATE_SOURCE_OVERRIDE is set: this build takes updates from ${override}. Never publish it.`,
		);
		defines.__UPDATE_SOURCE_OVERRIDE__ = JSON.stringify(override);
	}
	return defines;
}
