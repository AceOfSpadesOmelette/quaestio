import { parseDashboard } from "../src/parse-dashboard";
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
correct-score: Correct: {x} / {y}
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
		expect(parsed.spec.items[1]).toMatchObject({ format: "Correct: {x} / {y}" });
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
			format: "Incorrect: {x} / {y}",
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
		expect(formatScoreLine("Correct: {x} / {y} ({pct}%)", "correct-score", MIXED)).toBe(
			"Correct: 1 / 3 (33.33%)",
		);
		expect(formatScoreLine("Incorrect: {x} / {y}", "incorrect-score", MIXED)).toBe(
			"Incorrect: 1 / 3",
		);
		expect(formatScoreLine("Unanswered: {x} / {y}", "unanswered-score", MIXED)).toBe(
			"Unanswered: 1 / 3",
		);
	});

	it("drops unanswered from correct and incorrect denominators when include-unanswered is false", () => {
		expect(formatScoreLine("Correct: {x} / {y} ({pct}%)", "correct-score", MIXED, false)).toBe(
			"Correct: 1 / 2 (50%)",
		);
		expect(formatScoreLine("Incorrect: {x} / {y}", "incorrect-score", MIXED, false)).toBe(
			"Incorrect: 1 / 2",
		);
		expect(formatScoreLine("Unanswered: {x} / {y}", "unanswered-score", MIXED, false)).toBe(
			"Unanswered: 1 / 3",
		);
	});

	it("uses zero when there are no questions", () => {
		const empty: ScoreCounts = { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
		expect(formatScoreLine("{x}/{y} {pct}", "correct-score", empty)).toBe("0/0 0");
		expect(formatScoreLine("{x}/{y} {pct}", "correct-score", empty, false)).toBe("0/0 0");
		expect(formatScoreLine("{pct}", "unanswered-score", empty)).toBe("0");
	});
});
