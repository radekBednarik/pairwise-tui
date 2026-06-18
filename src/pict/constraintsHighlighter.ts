import { SyntaxStyle } from "@opentui/core";

const PICT_STYLES = {
	keyword: { fg: "#9d7cd8", bold: true },
	logical: { fg: "#bb9af7" },
	function: { fg: "#7aa2f7" },
	special: { fg: "#2ac3de" },
	operator: { fg: "#89ddff" },
	param: { fg: "#e0af68" },
	string: { fg: "#9ece6a" },
	number: { fg: "#ff9e64" },
	semicolon: { fg: "#565f89" },
	delimiter: { fg: "#a9b1d6" },
} as const;

type TokenType = keyof typeof PICT_STYLES;

interface Token {
	start: number;
	end: number;
	type: TokenType;
}

// Ordered by priority — earlier entries win on overlap
const TOKEN_PATTERNS: Array<[RegExp, TokenType]> = [
	[/"[^"]*"/g, "string"],
	[/\[[^\]]*\]/g, "param"],
	[/\b(ISNEGATIVE|ISPOSITIVE)\b/gi, "function"],
	[/\b(IF|THEN|ELSE)\b/gi, "keyword"],
	[/\b(AND|OR|NOT)\b/gi, "logical"],
	[/\b(IN|LIKE)\b/gi, "special"],
	[/<>|>=|<=|>|<|=/g, "operator"],
	[/\b\d+(?:\.\d+)?\b/g, "number"],
	[/;/g, "semicolon"],
	[/[{}()]/g, "delimiter"],
];

let _syntaxStyle: SyntaxStyle | null = null;
const _styleIds: Partial<Record<TokenType, number>> = {};

function initStyle(): void {
	if (_syntaxStyle) return;
	_syntaxStyle = SyntaxStyle.fromStyles(PICT_STYLES);
	for (const name of Object.keys(PICT_STYLES) as TokenType[]) {
		const id = _syntaxStyle.getStyleId(name);
		if (id !== null) _styleIds[name] = id;
	}
}

export function getPictSyntaxStyle(): SyntaxStyle {
	initStyle();
	// biome-ignore lint/style/noNonNullAssertion: guaranteed by initStyle()
	return _syntaxStyle!;
}

function tokenize(text: string): Token[] {
	if (!text) return [];

	const occupied = new Uint8Array(text.length);
	const tokens: Token[] = [];

	for (const [pattern, type] of TOKEN_PATTERNS) {
		const re = new RegExp(pattern.source, pattern.flags);
		let match = re.exec(text);
		while (match !== null) {
			const start = match.index;
			const end = start + match[0].length;
			let overlaps = false;
			for (let i = start; i < end; i++) {
				if (occupied[i]) {
					overlaps = true;
					break;
				}
			}
			if (!overlaps) {
				tokens.push({ start, end, type });
				occupied.fill(1, start, end);
			}
			match = re.exec(text);
		}
	}

	return tokens;
}

// biome-ignore lint/suspicious/noExplicitAny: OpenTUI renderable types are not exported
export function applyPictHighlights(ref: any, text: string): void {
	if (!ref) return;
	initStyle();

	ref.clearAllHighlights();

	for (const token of tokenize(text)) {
		const styleId = _styleIds[token.type];
		if (styleId !== undefined) {
			ref.addHighlightByCharRange({
				start: token.start,
				end: token.end,
				styleId,
			});
		}
	}
}
