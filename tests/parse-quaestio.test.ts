import {
	gradeSelection,
	parseQuaestio,
	validateFlags,
} from "../src/parse-quaestio";
import {
	updateOptionMarkers,
	updateQuaestioBody,
	upsertAnswerRevealed,
} from "../src/serialize-quaestio";
import type { QuaestioQuestion } from "../src/types";

const SINGLE = `number-of-correct-answers: 1
correct-index: [2]
question-title: Question 1
question-stem: What is 1 + 1?

[ ] A. 1
[ ] B. 2
[ ] C. 3
[ ] D. 4

correct-answer: B. 2
explanation: 1 plus 1 is equal to 2.`;

const MULTI = `number-of-correct-answers: 2
correct-index: [2, 4]
question-title: Question 3
question-stem: Which of the following numbers are even?

[ ] A. 1
[ ] B. 2
[ ] C. 3
[ ] D. 4

correct-answer: B. 2, D. 4
explanation: Select both B and D.`;

describe("parseQuaestio", () => {
	it("parses a single-correct block", () => {
		const result = parseQuaestio(SINGLE);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.question.numberOfCorrectAnswers).toBe(1);
		expect(result.question.correctIndexes).toEqual([2]);
		expect(result.question.title).toBe("Question 1");
		expect(result.question.stem).toBe("What is 1 + 1?");
		expect(result.question.options).toHaveLength(4);
		expect(result.question.options[1]?.text).toContain("B. 2");
		expect(result.question.correctAnswerRaw).toBe("B. 2");
	});

	it("parses multi-correct indexes", () => {
		const result = parseQuaestio(MULTI);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.question.numberOfCorrectAnswers).toBe(2);
		expect(result.question.correctIndexes).toEqual([2, 4]);
	});

	it("reads pre-selected options", () => {
		const source = `number-of-correct-answers: 1
correct-index: [2]
question-title: Question 2
question-stem: What is 2 + 2?

[x] A. 3
[ ] B. 4

correct-answer: B. 4`;
		const result = parseQuaestio(source);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.question.options[0]?.selected).toBe(true);
		expect(result.question.options[1]?.selected).toBe(false);
	});

	it("rejects empty blocks", () => {
		const result = parseQuaestio("");
		expect(result.ok).toBe(false);
	});
});

describe("validateFlags", () => {
	it("accepts matching flags", () => {
		expect(validateFlags(1, [2], 4)).toBeNull();
		expect(validateFlags(2, [2, 4], 4)).toBeNull();
	});

	it("rejects mismatched counts", () => {
		expect(validateFlags(2, [2], 4)).toMatch(/does not match/);
	});

	it("rejects out-of-range indexes", () => {
		expect(validateFlags(1, [5], 4)).toMatch(/out of range|invalid/i);
	});
});

describe("gradeSelection", () => {
	function q(overrides: Partial<QuaestioQuestion> & { selected: number[] }): QuaestioQuestion {
		const options = [1, 2, 3, 4].map((index) => ({
			index,
			text: `Option ${index}`,
			selected: overrides.selected.includes(index),
		}));
		return {
			numberOfCorrectAnswers: overrides.numberOfCorrectAnswers ?? 1,
			correctIndexes: overrides.correctIndexes ?? [2],
			title: "T",
			stem: "S",
			correctAnswerRaw: "A",
			explanation: "E",
			answerRevealed: false,
			options,
		};
	}

	it("returns unanswered when nothing selected", () => {
		expect(gradeSelection(q({ selected: [] }))).toBe("unanswered");
	});

	it("returns correct for exact match", () => {
		expect(gradeSelection(q({ selected: [2] }))).toBe("correct");
	});

	it("returns incorrect for wrong or partial multi", () => {
		expect(gradeSelection(q({ selected: [1] }))).toBe("incorrect");
		expect(
			gradeSelection(
				q({ selected: [2], numberOfCorrectAnswers: 2, correctIndexes: [2, 4] }),
			),
		).toBe("incorrect");
		expect(
			gradeSelection(
				q({ selected: [2, 4], numberOfCorrectAnswers: 2, correctIndexes: [2, 4] }),
			),
		).toBe("correct");
	});
});

describe("serialize-quaestio", () => {
	it("updates option markers by 1-based index", () => {
		const next = updateOptionMarkers(SINGLE, { 2: true });
		expect(next).toContain("[x] B. 2");
		expect(next).toContain("[ ] A. 1");
	});

	it("upserts answer-revealed", () => {
		const withFlag = upsertAnswerRevealed(SINGLE, true);
		expect(withFlag).toMatch(/answer-revealed:\s*true/i);
		const flipped = upsertAnswerRevealed(withFlag, false);
		expect(flipped).toMatch(/answer-revealed:\s*false/i);
		expect(flipped.match(/answer-revealed:/gi)?.length).toBe(1);
	});

	it("round-trips body updates", () => {
		const body = updateQuaestioBody(SINGLE, { 2: true }, true);
		const parsed = parseQuaestio(body);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.question.options[1]?.selected).toBe(true);
		expect(parsed.question.answerRevealed).toBe(true);
	});
});
