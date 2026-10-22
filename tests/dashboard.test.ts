import { parseDashboard } from "../src/parse-dashboard";
import { formatPercent, formatScoreLine, type ScoreCounts } from "../src/score-format";

const MIXED: ScoreCounts = {
	correct: 1,
	incorrect: 1,
	unanswered: 1,
	total: 3,
};

describe("quaestio-dashboard parse", () => {
	it("keeps visible flag order and defaults live-update to true", () => {
		const parsed = parseDashboard(`
reset-all
correct-score: Correct: {x} / {y}
check-all
`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.spec.liveUpdate).toBe(true);
		expect(parsed.spec.items.map((item) => item.kind)).toEqual([
			"reset-all",
			"correct-score",
			"check-all",
		]);
		expect(parsed.spec.items[1]).toMatchObject({ format: "Correct: {x} / {y}" });
	});

	it("reads live-update false and default score formats", () => {
		const parsed = parseDashboard(`
live-update: false
total-score
incorrect-score
`);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.spec.liveUpdate).toBe(false);
		expect(parsed.spec.items[0]).toMatchObject({ kind: "total-score", format: "Total: {y}" });
		expect(parsed.spec.items[1]).toMatchObject({
			kind: "incorrect-score",
			format: "Incorrect: {x} / {y}",
		});
	});

	it("rejects unknown and duplicate flags", () => {
		expect(parseDashboard("check-everything").ok).toBe(false);
		expect(parseDashboard("check-all\ncheck-all").ok).toBe(false);
		expect(parseDashboard("live-update: maybe").ok).toBe(false);
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
		expect(formatScoreLine("Total: {y} ({pct}%)", "total-score", MIXED)).toBe("Total: 3 (100%)");
	});

	it("uses zero when there are no questions", () => {
		const empty: ScoreCounts = { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
		expect(formatScoreLine("{x}/{y} {pct}", "correct-score", empty)).toBe("0/0 0");
		expect(formatScoreLine("{pct}", "total-score", empty)).toBe("0");
	});
});
