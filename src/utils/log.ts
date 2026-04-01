import type { LogMessage } from "../types";

export let nextLogId = 0;

export function formatLogEntry(msg: LogMessage): string {
	const ts = msg.timestamp.toLocaleTimeString();
	return `${ts} [${msg.type === "error" ? "ERR" : "INF"}] ${msg.text}`;
}

export function incrementLogId(): number {
	return nextLogId++;
}
