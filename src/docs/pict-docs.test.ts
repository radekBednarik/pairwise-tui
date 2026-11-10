import { expect, test } from "bun:test";
import { DOC_CHAPTERS } from "./pict-docs";

const helpText = DOC_CHAPTERS.flatMap((chapter) => chapter.content).join("\n");

test("the in-app help lists the current AI models", () => {
	expect(helpText).toContain("Haiku 5.5 / Sonnet 5.5 / Opus 5.5 / Fable 5.2");
	expect(helpText).toMatch(/Fable 5\.2 +.*most capable/);
});

test("the in-app help names Fable 5.2 in the data-retention note", () => {
	expect(helpText).toContain("Fable 5.2 requires 30-day data retention");
});

test("the in-app help no longer mentions Fable 5.1", () => {
	expect(helpText).not.toContain("Fable 5.1");
});
