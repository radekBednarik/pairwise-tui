import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LogMessage } from "../types";
import { formatLogEntry, incrementLogId } from "../utils/log";

export interface StatusLogState {
	status: string;
	statusIsError: boolean;
	logMessages: LogMessage[];
	logOpen: boolean;
	logSelectedIndex: number;
	logScrollOffset: number;
	showStatus: (msg: string, isError?: boolean) => void;
	setLogOpen: (v: boolean) => void;
	setLogSelectedIndex: Dispatch<SetStateAction<number>>;
	setLogScrollOffset: Dispatch<SetStateAction<number>>;
	formatLogEntry: (msg: LogMessage) => string;
}

export function useStatusLog(): StatusLogState {
	const [status, setStatus] = useState("");
	const [statusIsError, setStatusIsError] = useState(false);
	const [logMessages, setLogMessages] = useState<LogMessage[]>([]);
	const [logOpen, setLogOpen] = useState(false);
	const [logSelectedIndex, setLogSelectedIndex] = useState(0);
	const [logScrollOffset, setLogScrollOffset] = useState(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	const showStatus = useCallback((msg: string, isError = false) => {
		setStatus(msg);
		setStatusIsError(isError);
		setLogMessages((prev) => [
			...prev,
			{
				id: incrementLogId(),
				timestamp: new Date(),
				type: isError ? ("error" as const) : ("info" as const),
				text: msg,
			},
		]);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setStatus(""), 4000);
	}, []);

	return {
		status,
		statusIsError,
		logMessages,
		logOpen,
		logSelectedIndex,
		logScrollOffset,
		showStatus,
		setLogOpen,
		setLogSelectedIndex,
		setLogScrollOffset,
		formatLogEntry,
	};
}
