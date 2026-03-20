import type { OutputConfig, OutputFormat, TestCase } from "../types";

export interface OutputWriter {
	extension: string;
	write(headers: string[], rows: TestCase[], filePath: string): Promise<void>;
}

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
};

export async function saveTestCases(
	headers: string[],
	rows: TestCase[],
	config: OutputConfig,
): Promise<void> {
	const writer = writers[config.format];
	await writer.write(headers, rows, config.filePath);
}
