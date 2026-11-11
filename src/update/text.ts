export const MAX_NOTES_LENGTH = 20_000;

// Text from a release (or read back from update.json, which anyone who can
// write the config directory controls) ends up printed in a terminal.
//
// Removing every control character (C0 except newline and tab, DEL, C1)
// takes the ESC and CSI introducers with it, so no escape sequence survives
// to move the cursor, recolour the screen or set the window title.
//
// Bidirectional overrides and invisible characters are removed as well: they
// cannot run anything, but they can make text read differently from what it
// is (a file name shown reversed, a word hidden).
const UNSAFE_CHARS =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
	/[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;

/** Plain, printable text: safe to show, capped in length. */
export function sanitizeNotes(value: unknown): string {
	if (typeof value !== "string") return "";
	return value
		.replace(/\r\n?/g, "\n")
		.replace(UNSAFE_CHARS, "")
		.slice(0, MAX_NOTES_LENGTH);
}
