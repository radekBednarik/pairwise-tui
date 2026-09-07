export const TIMESTAMP_PLACEHOLDER = "{timestamp}";

// Colons are illegal in Windows paths and the fractional seconds add a second
// dot to the name, so both are stripped from the ISO form.
function fileTimestamp(now: Date): string {
	return now.toISOString().replace(/:/g, "-").replace(/\..+/, "");
}

/** Expands the placeholders a user may type into a file path or name. */
export function expandFileTemplate(
	template: string,
	now: Date = new Date(),
): string {
	return template.replaceAll(TIMESTAMP_PLACEHOLDER, fileTimestamp(now));
}
