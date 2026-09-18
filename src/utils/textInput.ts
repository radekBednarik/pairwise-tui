import type { ActiveOptionField, ActivePanel } from "../constants";

// The model-tab panels and options-tab fields whose keys go to an <input> or
// <textarea>. Single source for the keyboard router (which must hand those
// keys to the input) and for overlay opens (which must not replace the tab
// while one is focused: that unmounts the input and discards the typed text).
export const TEXT_INPUT_PANELS: ReadonlySet<ActivePanel> = new Set([
	"adding",
	"values",
	"constraints",
	"submodel-adding",
]);
export const TEXT_INPUT_OPTION_FIELDS: ReadonlySet<ActiveOptionField> = new Set(
	["filepath", "order", "storagePath", "fileTemplate"],
);

/**
 * Whether a text input is focused on screen. Scoped to the visible tab: a
 * panel or field state that belongs to another tab has no input rendered.
 */
export function isTextInputActive(
	activeTab: number,
	activePanel: ActivePanel,
	activeOptionField: ActiveOptionField,
): boolean {
	if (activeTab === 0) return TEXT_INPUT_PANELS.has(activePanel);
	if (activeTab === 1) return TEXT_INPUT_OPTION_FIELDS.has(activeOptionField);
	return false;
}
