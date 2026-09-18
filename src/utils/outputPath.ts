import type { OutputFormat } from "../types";

// Steps through the formats in FORMAT_EXTENSIONS key order, wrapping at both
// ends, so every place that cycles formats agrees on the order.
export function cycleFormat(
	current: OutputFormat,
	delta: 1 | -1,
	formatExtensions: Record<OutputFormat, string>,
): OutputFormat {
	const formats = Object.keys(formatExtensions) as OutputFormat[];
	const idx = formats.indexOf(current);
	return formats[(idx + delta + formats.length) % formats.length] ?? "txt";
}

// The file name starts after the last separator (either flavor); everything
// before it is a directory prefix, so a dot in "out.d/cases" is never an
// extension. Single source of that rule for the two helpers below.
function splitFilePath(filePath: string): { dir: string; name: string } {
	const cut = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	return { dir: filePath.slice(0, cut + 1), name: filePath.slice(cut + 1) };
}

// A leading dot (".env") is part of the name, not an extension; a name
// without any other dot has no extension. Shared so withExtension and
// formatFromExtension can never disagree about where the extension starts.
function extensionStart(name: string): number {
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? -1 : dot;
}

// Swaps the extension on the file name only: a dot inside a directory
// ("out.d/cases"), a name with no extension at all ("cases_{timestamp}") and
// a dotfile-style name (".env") must survive untouched.
export function withExtension(filePath: string, extension: string): string {
	const { dir, name } = splitFilePath(filePath);
	const dot = extensionStart(name);
	const base = (dot === -1 ? name : name.slice(0, dot)) || "output";
	return `${dir}${base}${extension}`;
}

// Maps a typed extension back to its format ("cases.json" -> "json") so a
// path the user types can win over the format selector and the file content
// always matches its name. Unknown or missing extensions return null and
// leave the selected format in charge.
export function formatFromExtension(
	filePath: string,
	formatExtensions: Record<OutputFormat, string>,
): OutputFormat | null {
	const { name } = splitFilePath(filePath);
	const dot = extensionStart(name);
	if (dot === -1) return null;
	const extension = name.slice(dot).toLowerCase();
	const match = (
		Object.entries(formatExtensions) as [OutputFormat, string][]
	).find(([, ext]) => ext === extension);
	return match ? match[0] : null;
}
