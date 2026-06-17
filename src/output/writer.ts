import * as XLSX from "xlsx";
import type { ExportContext, OutputFormat, TestCase } from "../types";

export interface OutputWriter {
	extension: string;
	write(context: ExportContext): Promise<void>;
}

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
	txt: ".txt",
	json: ".json",
	csv: ".csv",
	xlsx: ".xlsx",
	md: ".md",
};

function mdEscape(v: string): string {
	return v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function renderMdTable(headers: string[], rows: TestCase[]): string {
	const header = `| ${headers.map(mdEscape).join(" | ")} |`;
	const divider = `| ${headers.map(() => "---").join(" | ")} |`;
	const dataRows = rows.map(
		(r) => `| ${headers.map((h) => mdEscape(r[h] ?? "")).join(" | ")} |`,
	);
	return [header, divider, ...dataRows].join("\n");
}

const writers: Record<OutputFormat, OutputWriter> = {
	txt: {
		extension: ".txt",
		async write({ headers, rows, config }) {
			const lines = [
				headers.join("\t"),
				...rows.map((r) => headers.map((h) => r[h] ?? "").join("\t")),
			];
			await Bun.write(config.filePath, `${lines.join("\n")}\n`);
		},
	},
	json: {
		extension: ".json",
		async write({ rows, config }) {
			await Bun.write(config.filePath, JSON.stringify(rows, null, 2));
		},
	},
	csv: {
		extension: ".csv",
		async write({ headers, rows, config }) {
			const csvEscape = (v: string) =>
				v.includes(",") || v.includes('"') || v.includes("\n")
					? `"${v.replace(/"/g, '""')}"`
					: v;
			const lines = [
				headers.map(csvEscape).join(","),
				...rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")),
			];
			await Bun.write(config.filePath, `${lines.join("\n")}\n`);
		},
	},
	xlsx: {
		extension: ".xlsx",
		async write({ headers, rows, config }) {
			const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
			const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
			await Bun.write(config.filePath, buf);
		},
	},
	md: {
		extension: ".md",
		async write({ headers, rows, config, model, options }) {
			const sections: string[] = ["# Pairwise Test Cases"];

			const modelLines = model.parameters.map(
				(p) => `**${p.name}:** ${p.values.join(", ")}`,
			);
			sections.push(`## Model\n\n${modelLines.join("\n")}`);

			if (model.submodels.length > 0) {
				const subLines = model.submodels.map(
					(s) => `- ${s.paramNames.join(", ")} @ ${s.order}`,
				);
				sections.push(`## Submodels\n\n${subLines.join("\n")}`);
			}

			const constraints = model.constraints.trim();
			if (constraints) {
				sections.push(`## Constraints\n\n\`\`\`\n${constraints}\n\`\`\``);
			}

			const optLines = [
				`- Combination order: ${options.order}`,
				`- Randomize: ${options.randomize}`,
				`- Case sensitive: ${options.caseSensitive}`,
			];
			sections.push(`## Options\n\n${optLines.join("\n")}`);

			const table = renderMdTable(headers, rows);
			sections.push(
				`## Results\n\n${rows.length} test cases generated.\n\n${table}`,
			);

			await Bun.write(config.filePath, `${sections.join("\n\n")}\n`);
		},
	},
};

export async function saveTestCases(context: ExportContext): Promise<void> {
	const writer = writers[context.config.format];
	await writer.write(context);
}
