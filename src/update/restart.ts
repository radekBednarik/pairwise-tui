import type { InstallKind } from "./platform";

type Env = Record<string, string | undefined>;

interface SpawnedChild {
	exited: Promise<number>;
}

export interface RestartOptions {
	kind: InstallKind;
	/** The freshly installed app file. */
	target: string;
	/** Version now installed, for the fallback message. */
	version: string;
	/** Arguments the user started the app with. */
	args?: string[];
	env?: Env;
	execve?: ((file: string, args: string[], env: Env) => void) | undefined;
	spawn?: (
		cmd: string[],
		options: { stdio: ["inherit", "inherit", "inherit"] },
	) => SpawnedChild;
	print?: (line: string) => void;
	/**
	 * Gives up the console input before a child takes the console over
	 * (Windows only). Replaceable for tests.
	 */
	releaseInput?: () => void;
}

// Set by the AppImage runtime for the mount that is about to go away. The new
// AppImage sets its own; stale values would point it at the old mount.
const APPIMAGE_VARS = ["APPIMAGE", "APPDIR", "ARGV0", "OWD"];

// The parent stays alive while the child runs, attached to the same console.
// It must not keep reading it: two readers would split the key presses
// between them. The renderer is already destroyed at this point; this makes
// the hand-over explicit instead of relying on that.
function releaseConsoleInput(): void {
	const stdin = process.stdin;
	if (stdin.isTTY) stdin.setRawMode(false);
	stdin.pause();
	stdin.unref?.();
}

function userArgs(): string[] {
	// A compiled Bun executable has ["bun", "<embedded entry>", ...user args].
	return process.argv.slice(2);
}

/**
 * Starts the newly installed version in the same terminal. The caller must
 * have destroyed the renderer first, so the terminal is back to normal.
 *
 * Linux and AppImage replace the process image (`execve`): same terminal,
 * same pid, and this function never returns. Windows has no such call, so the
 * new program runs as a child with the console inherited while this process
 * waits and then passes the child's exit code on. Whenever neither works, the
 * user is asked to start the app again, and 0 is returned.
 */
export async function restartInto(options: RestartOptions): Promise<number> {
	const { kind, target, version } = options;
	const args = options.args ?? userArgs();
	const env: Env = { ...(options.env ?? process.env) };
	const print = options.print ?? ((line: string) => console.log(line));
	const fallback = (): number => {
		print(`Updated to ${version}. Please start pairwise-tui again.`);
		return 0;
	};

	if (kind === "windows") {
		const spawn =
			options.spawn ??
			((cmd, spawnOptions) => Bun.spawn(cmd, spawnOptions) as SpawnedChild);
		try {
			(options.releaseInput ?? releaseConsoleInput)();
		} catch {
			// Not a terminal, or already released: the restart goes ahead.
		}
		try {
			const child = spawn([target, ...args], {
				stdio: ["inherit", "inherit", "inherit"],
			});
			return await child.exited;
		} catch {
			return fallback();
		}
	}

	// `in`: an explicit `execve: undefined` means "this runtime has none".
	const execve =
		"execve" in options
			? options.execve
			: (process as { execve?: RestartOptions["execve"] }).execve?.bind(
					process,
				);
	if (!execve) return fallback();
	if (kind === "appimage") {
		for (const name of APPIMAGE_VARS) delete env[name];
	}
	try {
		execve(target, [target, ...args], env);
	} catch {
		return fallback();
	}
	// Only reached with a stubbed execve.
	return 0;
}
