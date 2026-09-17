/**
 * Which full-screen overlay (if any) currently takes over the content area,
 * replacing the tab strip. `null` means no overlay is active and the
 * tabs (Model/Options/Results) should render instead.
 */
export type OverlayKind =
	| "log"
	| "docs"
	| "picker"
	| "aiSetup"
	| "aiPrompt"
	| "clearConfirm"
	| "generateSave";

export interface OverlayFlags {
	logOpen: boolean;
	docsOpen: boolean;
	pickerOpen: boolean;
	aiSetupOpen: boolean;
	aiPromptOpen: boolean;
	showClearConfirm: boolean;
	generateSaveOpen: boolean;
}

// Precedence order when more than one flag is set, highest first. Kept as a
// single list so the render switch and the status bar's active-panel lookup
// can never disagree about which overlay wins.
const OVERLAY_PRECEDENCE: ReadonlyArray<{
	kind: OverlayKind;
	flag: keyof OverlayFlags;
}> = [
	{ kind: "log", flag: "logOpen" },
	{ kind: "docs", flag: "docsOpen" },
	{ kind: "picker", flag: "pickerOpen" },
	{ kind: "aiSetup", flag: "aiSetupOpen" },
	{ kind: "aiPrompt", flag: "aiPromptOpen" },
	{ kind: "clearConfirm", flag: "showClearConfirm" },
	{ kind: "generateSave", flag: "generateSaveOpen" },
];

export function resolveActiveOverlay(flags: OverlayFlags): OverlayKind | null {
	const active = OVERLAY_PRECEDENCE.find(({ flag }) => flags[flag]);
	return active ? active.kind : null;
}
