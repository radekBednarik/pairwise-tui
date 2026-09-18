/**
 * Sets environment variables for a test and returns a restore function.
 * Variables that were unset stay unset afterwards: assigning `undefined` to
 * `process.env` would store the string "undefined" and leak into later tests.
 */
export function overrideEnv(values: Record<string, string>): () => void {
	const saved = Object.fromEntries(
		Object.keys(values).map((name) => [name, process.env[name]]),
	);
	for (const [name, value] of Object.entries(values)) {
		process.env[name] = value;
	}
	return () => {
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	};
}
