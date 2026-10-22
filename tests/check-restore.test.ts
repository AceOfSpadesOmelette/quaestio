import type { App, MarkdownPostProcessorContext } from "obsidian";
import { renderQuaestio } from "../src/render-quaestio";

function ctx(sourcePath: string): MarkdownPostProcessorContext {
	return {
		sourcePath,
		addChild() {},
		getSectionInfo() {
			return null;
		},
	} as unknown as MarkdownPostProcessorContext;
}

function block(title: string, extra: string): string {
	return `number-of-correct-answers: 1
correct-index: [2]
question-title: ${title}
question-stem: Stem?

[x] A. 1
[ ] B. 2
[ ] C. 3

correct-answer: B
explanation: Because.
${extra}`;
}

describe("check restore", () => {
	it("shows Incorrect from answer-checked without clicking Check", () => {
		const el = document.createElement("div");
		renderQuaestio(
			{} as App,
			block("Restore incorrect", "answer-checked: true"),
			el,
			ctx("restore-incorrect.md"),
		);
		const result = el.querySelector(".quaestio-result");
		expect(result?.textContent).toBe("Incorrect");
		expect(result?.hasAttribute("hidden")).toBe(false);
		expect(el.querySelector(".quaestio-option.is-incorrect")).not.toBeNull();
		expect(el.querySelector(".quaestio-option.is-missed")).not.toBeNull();
		expect(el.querySelector(".quaestio-reveal")?.hasAttribute("hidden")).toBe(true);
	});

	it("keeps the banner hidden when the selection was never checked", () => {
		const el = document.createElement("div");
		renderQuaestio(
			{} as App,
			block("Never checked", ""),
			el,
			ctx("never-checked.md"),
		);
		const result = el.querySelector(".quaestio-result");
		expect(result?.hasAttribute("hidden")).toBe(true);
		expect(result?.textContent).toBe("");
	});

	it("shows Correct when the saved selection matches", () => {
		const source = `number-of-correct-answers: 1
correct-index: [2]
question-title: Restore correct
question-stem: Stem?

[ ] A. 1
[x] B. 2
[ ] C. 3

answer-checked: true`;
		const el = document.createElement("div");
		renderQuaestio({} as App, source, el, ctx("restore-correct.md"));
		expect(el.querySelector(".quaestio-result")?.textContent).toBe("Correct");
		expect(el.querySelector(".quaestio-option.is-correct")).not.toBeNull();
	});

	it("shows Unanswered when Check was saved with no selection", () => {
		const source = `number-of-correct-answers: 1
correct-index: [2]
question-title: Restore blank
question-stem: Stem?

[ ] A. 1
[ ] B. 2
[ ] C. 3

answer-checked: true`;
		const el = document.createElement("div");
		renderQuaestio({} as App, source, el, ctx("restore-blank.md"));
		expect(el.querySelector(".quaestio-result")?.textContent).toBe("Unanswered");
	});
});
