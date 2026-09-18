import { expect, test } from "bun:test";
import { nextOptionField } from "./constants";

test("Tab moves to the next options field and wraps to the first", () => {
	expect(nextOptionField("filepath")).toBe("format");
	expect(nextOptionField("none")).toBe("filepath");
});
