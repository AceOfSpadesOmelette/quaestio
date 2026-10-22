import { parseDashboard } from "../src/parse-dashboard";
import { quaestioBlockKey, scoreMarkdown } from "../src/score-note";
import { formatPercent, formatScoreLine, type ScoreCounts } from "../src/score-format";

const MIXED: ScoreCounts = {
	correct: 1,
	incorrect: 1,
	unanswered: 1,
	total: 3,
};

describe("quaestio-dashboard parse", () => {
	it("keeps visible flag order and defaults live-update and include-unanswered to true", () => {
		const parsed = parseDashboard(`
reset-all
correct-score: Correct: {count} / {total}
check-all
`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.spec.liveUpdate).toBe(true);
		expect(parsed.spec.includeUnanswered).toBe(true);
		expect(parsed.spec.items.map((item) => item.kind)).toEqual([
			"reset-all",
			"correct-score",
			"check-all",
		]);
		expect(parsed.spec.items[1]).toMatchObject({ format: "Correct: {count} / {total}" });
	});

	it("reads live-update and include-unanswered false, and default score formats", () => {
		const parsed = parseDashboard(`
live-update: false
include-unanswered: false
incorrect-score
`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.spec.liveUpdate).toBe(false);
		expect(parsed.spec.includeUnanswered).toBe(false);
		expect(parsed.spec.items[0]).toMatchObject({
			kind: "incorrect-score",
			format: "Incorrect: {count} / {total}",
		});
	});

	it("rejects unknown, duplicate, and removed total-score flags", () => {
		expect(parseDashboard("check-everything").ok).toBe(false);
		expect(parseDashboard("check-all\ncheck-all").ok).toBe(false);
		expect(parseDashboard("live-update: maybe").ok).toBe(false);
		expect(parseDashboard("include-unanswered: maybe").ok).toBe(false);
		expect(parseDashboard("total-score: Total: {y}").ok).toBe(false);
	});
});

describe("score formatting", () => {
	it("formats counts and percentages to at most 2 decimals", () => {
		expect(formatPercent(100 / 3)).toBe("33.33");
		expect(formatPercent(50)).toBe("50");
		expect(formatPercent(33.3)).toBe("33.3");
		expect(formatScoreLine("Correct: {count} / {total} ({pct}%)", "correct-score", MIXED)).toBe(
			"Correct: 1 / 3 (33.33%)",
		);
		expect(formatScoreLine("Incorrect: {count} / {total}", "incorrect-score", MIXED)).toBe(
			"Incorrect: 1 / 3",
		);
		expect(formatScoreLine("Unanswered: {count} / {total}", "unanswered-score", MIXED)).toBe(
			"Unanswered: 1 / 3",
		);
	});

	it("still expands legacy {x} and {y} tokens", () => {
		expect(formatScoreLine("Correct: {x} / {y} ({pct}%)", "correct-score", MIXED)).toBe(
			"Correct: 1 / 3 (33.33%)",
		);
	});

	it("drops unanswered from correct and incorrect denominators when include-unanswered is false", () => {
		expect(formatScoreLine("Correct: {count} / {total} ({pct}%)", "correct-score", MIXED, false)).toBe(
			"Correct: 1 / 2 (50%)",
		);
		expect(formatScoreLine("Incorrect: {count} / {total}", "incorrect-score", MIXED, false)).toBe(
			"Incorrect: 1 / 2",
		);
		expect(formatScoreLine("Unanswered: {count} / {total}", "unanswered-score", MIXED, false)).toBe(
			"Unanswered: 1 / 3",
		);
	});

	it("uses zero when there are no questions", () => {
		const empty: ScoreCounts = { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
		expect(formatScoreLine("{count}/{total} {pct}", "correct-score", empty)).toBe("0/0 0");
		expect(formatScoreLine("{x}/{y} {pct}", "correct-score", empty, false)).toBe("0/0 0");
		expect(formatScoreLine("{pct}", "unanswered-score", empty)).toBe("0");
	});
});

function question(title: string, markerLines: string): string {
	return `number-of-correct-answers: 1
correct-index: [2]
question-title: ${title}
question-stem: Stem?

${markerLines}`;
}

describe("score markdown", () => {
	const correct = question("Correct", "[ ] A. 1\n[x] B. 2\n[ ] C. 3");
	const incorrect = question("Incorrect", "[x] A. 1\n[ ] B. 2\n[ ] C. 3");
	const blank = question("Blank", "[ ] A. 1\n[ ] B. 2\n[ ] C. 3");
	const note = [
		"```quaestio-dashboard",
		"correct-score: Correct: {count} / {total}",
		"```",
		"```quaestio",
		correct,
		"```",
		"```quaestio",
		incorrect,
		"```",
		"```quaestio",
		blank,
		"```",
	].join("\n");

	it("grades every fence in the file, including ones that are not rendered", () => {
		const snap = scoreMarkdown("CISSP_D1.md", note);
		expect(snap).toEqual({
			total: 3,
			correct: 1,
			incorrect: 1,
			unanswered: 1,
			anyRevealed: false,
		});
	});

	it("keeps the same block key when answer-checked flips", () => {
		const base = question("Key", "[x] A. 1\n[ ] B. 2\n[ ] C. 3");
		const checked = `${base}\nanswer-checked: true`;
		const unchecked = `${base}\nanswer-checked: false`;
		expect(quaestioBlockKey("n.md", checked)).toBe(quaestioBlockKey("n.md", unchecked));
	});

	it("lets a live widget replace one fence without changing the total", () => {
		const snap = scoreMarkdown("CISSP_D1.md", note, [
			{
				key: quaestioBlockKey("CISSP_D1.md", blank),
				grade: "correct",
				revealed: true,
			},
		]);
		expect(snap.total).toBe(3);
		expect(snap.correct).toBe(2);
		expect(snap.incorrect).toBe(1);
		expect(snap.unanswered).toBe(0);
		expect(snap.anyRevealed).toBe(true);
	});
});
