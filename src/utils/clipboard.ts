import type { CliRenderer } from "@opentui/core";

function copyNative(text: string): boolean {
	try {
		const input = Buffer.from(text, "utf-8");

		if (process.platform === "win32") {
			return Bun.spawnSync(["clip.exe"], { stdin: input }).exitCode === 0;
		}

		if (process.platform === "darwin") {
			return Bun.spawnSync(["pbcopy"], { stdin: input }).exitCode === 0;
		}

		// Linux — Wayland first
		if (process.env.WAYLAND_DISPLAY) {
			if (Bun.spawnSync(["wl-copy"], { stdin: input }).exitCode === 0)
				return true;
		}

		// Linux — X11 fallback
		if (process.env.DISPLAY) {
			if (
				Bun.spawnSync(["xclip", "-selection", "clipboard"], { stdin: input })
					.exitCode === 0
			)
				return true;
			if (
				Bun.spawnSync(["xsel", "--clipboard", "--input"], { stdin: input })
					.exitCode === 0
			)
				return true;
		}

		return false;
	} catch {
		return false;
	}
}

export function copyToClipboard(text: string, renderer: CliRenderer): boolean {
	if (copyNative(text)) return true;
	return renderer.copyToClipboardOSC52(text);
}
