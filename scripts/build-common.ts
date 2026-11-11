type Env = Record<string, string | undefined>;

/**
 * Compile-time constants shared by the Linux and Windows builds.
 *
 * `__RELEASE_BUILD__` marks a compiled artifact: without it (running from
 * source) the updater is inert, because there `process.execPath` is the Bun
 * runtime and must never be replaced.
 *
 * `UPDATE_SOURCE_OVERRIDE` bakes a different release source into the build.
 * It exists only for the manual test rig (scripts/dev-fake-release.ts). A
 * build made without it contains the GitHub addresses only, and nothing at
 * runtime can change them. On CI, where published builds are made, it is
 * refused here, in the very step that would bake it in: a check elsewhere in
 * the workflow could not see a variable set on the build job itself.
 */
export function buildDefines(env: Env = process.env): Record<string, string> {
	const defines: Record<string, string> = { __RELEASE_BUILD__: "true" };
	const override = env.UPDATE_SOURCE_OVERRIDE;
	if (override) {
		if (env.GITHUB_ACTIONS || env.CI) {
			throw new Error(
				"UPDATE_SOURCE_OVERRIDE is set on CI. A published build must take its updates from the default source; unset it.",
			);
		}
		console.warn(
			`⚠ UPDATE_SOURCE_OVERRIDE is set: this build takes updates from ${override}. Never publish it.`,
		);
		defines.__UPDATE_SOURCE_OVERRIDE__ = JSON.stringify(override);
	}
	return defines;
}

/**
 * A compiled executable reads no configuration from the directory it is
 * started in. By default Bun would load `.env` and `bunfig.toml` from there:
 * started inside an untrusted folder, a `bunfig.toml` could preload and run
 * code, and a `.env` could set a proxy or switch off certificate checks for
 * the update download. The app's own settings live in its config directory.
 */
export const COMPILE_HARDENING = {
	autoloadDotenv: false,
	autoloadBunfig: false,
	autoloadTsconfig: false,
	autoloadPackageJson: false,
} as const;
