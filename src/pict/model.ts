import type { PictModel } from "../types";

export function buildModelFile(model: PictModel): string {
	const lines: string[] = [];
	for (const param of model.parameters) {
		lines.push(`${param.name}: ${param.values.join(", ")}`);
	}
	if (model.constraints.trim()) {
		lines.push("");
		lines.push(model.constraints.trim());
	}
	return `${lines.join("\n")}\n`;
}

export function parseModelFile(content: string): PictModel {
	const lines = content.split("\n");
	const parameters: Array<{ name: string; values: string[] }> = [];
	const constraintLines: string[] = [];
	let inConstraints = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (parameters.length > 0) inConstraints = true;
			continue;
		}

		if (inConstraints) {
			constraintLines.push(trimmed);
			continue;
		}

		const upper = trimmed.toUpperCase();
		if (
			upper.startsWith("IF ") ||
			upper.startsWith("ELSE ") ||
			trimmed.startsWith("#")
		) {
			inConstraints = true;
			constraintLines.push(trimmed);
			continue;
		}

		const colonIdx = trimmed.indexOf(":");
		if (colonIdx !== -1) {
			const name = trimmed.substring(0, colonIdx).trim();
			const valuesStr = trimmed.substring(colonIdx + 1).trim();
			const values = valuesStr
				.split(",")
				.map((v) => v.trim())
				.filter((v) => v.length > 0);
			parameters.push({ name, values });
		} else {
			constraintLines.push(trimmed);
		}
	}

	return { parameters, constraints: constraintLines.join("\n") };
}
