import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The current user's home directory, read the way Node documents
 * `os.homedir()`: `$HOME` on POSIX and `%USERPROFILE%` on Windows, falling
 * back to `os.homedir()` when the variable is unset or empty. The env var is
 * read directly because Bun's `os.homedir()` on Linux ignores a `HOME` that
 * was changed after start-up, which would make `~` deaf to the environment.
 */
function currentHome(): string {
	const fromEnv =
		process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME;
	return fromEnv ? fromEnv : homedir();
}

/**
 * Expands a leading `~` to the user's home directory so a typed
 * `~/out/cases.txt` lands in the home directory instead of a literal `./~`
 * folder. `~/` is accepted everywhere; `~\` only on Windows, because a
 * backslash is an ordinary file-name character on Linux and rewriting it would
 * change which file the user asked for. `~user` forms and a `~` elsewhere in
 * the path are left to the file system as typed. `home` defaults to the
 * current user's home directory.
 */
export function expandHomePath(
	path: string,
	home: string = currentHome(),
): string {
	if (path === "~") return home;
	const windowsPrefix = process.platform === "win32" && path.startsWith("~\\");
	if (path.startsWith("~/") || windowsPrefix) {
		return join(home, path.slice(2));
	}
	return path;
}
