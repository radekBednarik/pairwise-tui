import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Expands a leading `~` to the user's home directory so a typed
 * `~/out/cases.txt` lands in the home directory instead of a literal `./~`
 * folder. Both separators are accepted, so `~\out.txt` works on Windows as
 * well as `~/out.txt`; `~user` forms and a `~` elsewhere in the path are left
 * to the file system as typed. `home` defaults to `os.homedir()`, which reads
 * `HOME` on Linux and `USERPROFILE` on Windows.
 */
export function expandHomePath(path: string, home: string = homedir()): string {
	if (path === "~") return home;
	if (path.startsWith("~/") || path.startsWith("~\\")) {
		return join(home, path.slice(2));
	}
	return path;
}
