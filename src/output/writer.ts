import * as XLSX from "xlsx";
import type { OutputConfig, OutputFormat, TestCase } from "../types";

export interface OutputWriter {
	extension: string;
	write(headers: string[], rows: TestCase[], filePath: string): Promise<void>;
}

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
	txt: ".txt",
	json: ".json",
	csv: ".csv",
	xlsx: ".xlsx",
};

const writers: Record<OutputFormat, OutputWriter> = {
	txt: {
		extension: ".txt",
		async write(headers, rows, filePath) {
			const lines = [
				headers.join("\t"),
				...rows.map((r) => headers.map((h) => r[h] ?? "").join("\t")),
			];
			await Bun.write(filePath, `${lines.join("\n")}\n`);
		},
	},
	json: {
		extension: ".json",
		async write(_headers, rows, filePath) {
			await Bun.write(filePath, JSON.stringify(rows, null, 2));
		},
	},
	csv: {
		extension: ".csv",
		async write(headers, rows, filePath) {
			const csvEscape = (v: string) =>
				v.includes(",") || v.includes('"') || v.includes("\n")
					? `"${v.replace(/"/g, '""')}"`
					: v;
			const lines = [
				headers.map(csvEscape).join(","),
				...rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")),
			];
			await Bun.write(filePath, `${lines.join("\n")}\n`);
		},
	},
	xlsx: {
		extension: ".xlsx",
		async write(headers, rows, filePath) {
			const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
			const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
			await Bun.write(filePath, buf);
		},
	},
};

export async function saveTestCases(
	headers: string[],
	rows: TestCase[],
	config: OutputConfig,
): Promise<void> {
	const writer = writers[config.format];
	await writer.write(headers, rows, config.filePath);
}
