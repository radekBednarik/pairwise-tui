import type { PictModel, Submodel } from "../types";

export function buildModelFile(model: PictModel): string {
	const lines: string[] = [];
	for (const param of model.parameters) {
		lines.push(`${param.name}: ${param.values.join(", ")}`);
	}
	if (model.submodels.length > 0) {
		lines.push("");
		for (const sub of model.submodels) {
			lines.push(`{ ${sub.paramNames.join(", ")} } @ ${sub.order}`);
		}
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
	const submodels: Submodel[] = [];
	const constraintLines: string[] = [];
	let inConstraints = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (parameters.length > 0) inConstraints = true;
			continue;
		}

		// Submodel lines: { Param1, Param2 } @ N — check before inConstraints branch
		if (trimmed.startsWith("{")) {
			const match = trimmed.match(/^\{\s*([^}]+)\}\s*@\s*([1-9]\d*)/);
			if (match?.[1] && match?.[2]) {
				const paramNames = match[1]
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
				if (paramNames.length === 0) continue;
				const order = Number.parseInt(match[2], 10);
				submodels.push({ paramNames, order });
				continue;
			}
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

	return { parameters, submodels, constraints: constraintLines.join("\n") };
}
