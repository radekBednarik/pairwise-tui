/**
 * A local stand-in for the GitHub release source, for trying the update flow
 * by hand without publishing anything (specs/002-auto-update/quickstart.md).
 *
 * It serves whatever is in `dist/` as "the latest release", with the version
 * from package.json (or FAKE_VERSION):
 *
 *   GET /api/repos/radekBednarik/pairwise-tui/releases/latest
 *   GET /download/<tag>/SHA256SUMS.txt
 *   GET /download/<tag>/<asset>
 *
 * An app only talks to it when it was BUILT with the address baked in:
 *
 *   # 1. the "installed" old version
 *   #    (set "version": "9.9.8" in package.json first)
 *   UPDATE_SOURCE_OVERRIDE=http://localhost:8787 bun run build:dist:linux
 *   mkdir -p /tmp/pt-old && cp dist/pairwise-tui /tmp/pt-old/
 *   # 2. the "released" new version (set "version": "9.9.9")
 *   UPDATE_SOURCE_OVERRIDE=http://localhost:8787 bun run build:dist:linux
 *   # 3. serve it, then start the old one in another terminal
 *   bun scripts/dev-fake-release.ts
 *   /tmp/pt-old/pairwise-tui
 *
 * Restore package.json afterwards, and never publish a build made with
 * UPDATE_SOURCE_OVERRIDE set: it would take its updates from that address.
 *
 * Failure scenarios:
 *   FAKE_CORRUPT=1   serve the artifact with one byte changed  (checksum mismatch)
 *   FAKE_NO_SUM=1    leave the artifact out of SHA256SUMS.txt   (missing checksum)
 *   FAKE_VERSION=x   announce another version than package.json
 *   PORT=n           listen elsewhere (the builds must use the same address)
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import pkg from "../package.json";

const DIST = "./dist";
const ASSETS = [
	"pairwise-tui",
	"pairwise-tui.exe",
	"Pairwise-TUI-x86_64.AppImage",
];
const version = process.env.FAKE_VERSION ?? pkg.version;
const tag = `v${version}`;
const port = Number(process.env.PORT ?? 8787);
const corrupt = process.env.FAKE_CORRUPT === "1";
const noSum = process.env.FAKE_NO_SUM === "1";

const present = (await readdir(DIST).catch(() => [])).filter((name) =>
	ASSETS.includes(name),
);
if (present.length === 0) {
	console.error(
		`No release artifacts in ${DIST}. Build first (see the header).`,
	);
	process.exit(1);
}

async function sha256(path: string): Promise<string> {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(await Bun.file(path).arrayBuffer());
	return hasher.digest("hex");
}

async function checksums(): Promise<string> {
	const lines: string[] = [];
	for (const name of present) {
		if (noSum) continue;
		lines.push(`${await sha256(join(DIST, name))}  ${name}`);
	}
	return `${lines.join("\n")}\n`;
}

const server = Bun.serve({
	port,
	async fetch(request) {
		const { pathname } = new URL(request.url);
		console.log(`${new Date().toISOString()} ${request.method} ${pathname}`);

		if (pathname === "/api/repos/radekBednarik/pairwise-tui/releases/latest") {
			const assets = present.map((name) => ({
				name,
				size: Bun.file(join(DIST, name)).size,
			}));
			assets.push({
				name: "SHA256SUMS.txt",
				size: (await checksums()).length || 1,
			});
			return Response.json({
				tag_name: tag,
				draft: false,
				prerelease: false,
				html_url: `https://github.com/radekBednarik/pairwise-tui/releases/tag/${tag}`,
				body: [
					`## Fake release ${version}`,
					"",
					"Served by scripts/dev-fake-release.ts for local testing.",
					"",
					...Array.from({ length: 30 }, (_, i) => `- change number ${i + 1}`),
				].join("\n"),
				assets,
			});
		}

		const prefix = `/download/${tag}/`;
		if (pathname.startsWith(prefix)) {
			const name = decodeURIComponent(pathname.slice(prefix.length));
			if (name === "SHA256SUMS.txt") return new Response(await checksums());
			if (present.includes(name)) {
				if (!corrupt) return new Response(Bun.file(join(DIST, name)));
				const bytes = new Uint8Array(
					await Bun.file(join(DIST, name)).arrayBuffer(),
				);
				const last = bytes.length - 1;
				bytes[last] = (bytes[last] ?? 0) ^ 0xff;
				return new Response(bytes);
			}
		}
		return new Response("not found", { status: 404 });
	},
});

console.log(
	`Fake release ${tag} on http://localhost:${server.port} serving ${present.join(", ")}` +
		`${corrupt ? " [CORRUPT]" : ""}${noSum ? " [NO CHECKSUM]" : ""}`,
);
