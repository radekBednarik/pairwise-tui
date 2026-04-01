import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";

export interface ModalState {
	// File picker
	pickerOpen: boolean;
	pickerFiles: string[];
	pickerIndex: number;
	openPicker: (files: string[]) => void;
	closePicker: () => void;
	setPickerIndex: Dispatch<SetStateAction<number>>;
	// Docs
	docsOpen: boolean;
	docsView: "list" | "chapter";
	docsChapterIdx: number;
	docsScrollOffset: number;
	setDocsOpen: (v: boolean) => void;
	setDocsView: (v: "list" | "chapter") => void;
	setDocsChapterIdx: Dispatch<SetStateAction<number>>;
	setDocsScrollOffset: Dispatch<SetStateAction<number>>;
	// Clear confirm
	showClearConfirm: boolean;
	clearConfirmIndex: number;
	openClearConfirm: () => void;
	closeClearConfirm: () => void;
	setClearConfirmIndex: Dispatch<SetStateAction<number>>;
	// AI overlays
	aiSetupOpen: boolean;
	aiPromptOpen: boolean;
	aiPromptKey: number;
	aiKeyInput: string;
	aiError: string;
	aiIsLoading: boolean;
	openAiSetup: () => void;
	closeAiSetup: () => void;
	openAiPrompt: () => void;
	closeAiPrompt: () => void;
	setAiKeyInput: (v: string) => void;
	setAiError: (v: string) => void;
	setAiIsLoading: (v: boolean) => void;
}

export function useModalState(): ModalState {
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerFiles, setPickerFiles] = useState<string[]>([]);
	const [pickerIndex, setPickerIndex] = useState(0);

	const [docsOpen, setDocsOpen] = useState(false);
	const [docsView, setDocsView] = useState<"list" | "chapter">("list");
	const [docsChapterIdx, setDocsChapterIdx] = useState(0);
	const [docsScrollOffset, setDocsScrollOffset] = useState(0);

	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [clearConfirmIndex, setClearConfirmIndex] = useState(1);

	const [aiSetupOpen, setAiSetupOpen] = useState(false);
	const [aiPromptOpen, setAiPromptOpen] = useState(false);
	const [aiPromptKey, setAiPromptKey] = useState(0);
	const [aiKeyInput, setAiKeyInput] = useState("");
	const [aiError, setAiError] = useState("");
	const [aiIsLoading, setAiIsLoading] = useState(false);

	const openPicker = useCallback((files: string[]) => {
		setPickerFiles(files);
		setPickerIndex(0);
		setPickerOpen(true);
	}, []);

	const closePicker = useCallback(() => {
		setPickerOpen(false);
		setPickerFiles([]);
	}, []);

	const openClearConfirm = useCallback(() => {
		setClearConfirmIndex(1);
		setShowClearConfirm(true);
	}, []);

	const closeClearConfirm = useCallback(() => {
		setShowClearConfirm(false);
		setClearConfirmIndex(1);
	}, []);

	const openAiSetup = useCallback(() => {
		setAiPromptOpen(false);
		setAiError("");
		setAiKeyInput("");
		setAiSetupOpen(true);
	}, []);

	const closeAiSetup = useCallback(() => {
		setAiSetupOpen(false);
		setAiKeyInput("");
	}, []);

	const openAiPrompt = useCallback(() => {
		setAiPromptKey((k) => k + 1);
		setAiError("");
		setAiPromptOpen(true);
	}, []);

	const closeAiPrompt = useCallback(() => {
		setAiPromptOpen(false);
		setAiError("");
	}, []);

	return {
		pickerOpen,
		pickerFiles,
		pickerIndex,
		openPicker,
		closePicker,
		setPickerIndex,
		docsOpen,
		docsView,
		docsChapterIdx,
		docsScrollOffset,
		setDocsOpen,
		setDocsView,
		setDocsChapterIdx,
		setDocsScrollOffset,
		showClearConfirm,
		clearConfirmIndex,
		openClearConfirm,
		closeClearConfirm,
		setClearConfirmIndex,
		aiSetupOpen,
		aiPromptOpen,
		aiPromptKey,
		aiKeyInput,
		aiError,
		aiIsLoading,
		openAiSetup,
		closeAiSetup,
		openAiPrompt,
		closeAiPrompt,
		setAiKeyInput,
		setAiError,
		setAiIsLoading,
	};
}
