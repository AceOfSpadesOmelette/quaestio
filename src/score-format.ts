import type { ScoreKind } from "./parse-dashboard";

export interface ScoreCounts {
	correct: number;
	incorrect: number;
	unanswered: number;
	total: number;
}

/** Percent with at most 2 decimal places, trailing zeros dropped (50, 33.3, 33.33). */
export function formatPercent(percent: number): string {
	if (!Number.isFinite(percent)) return "0";
	const rounded = Math.round(percent * 100) / 100;
	return String(rounded);
}

export function formatScoreLine(format: string, kind: ScoreKind, counts: ScoreCounts): string {
	const y = counts.total;
	const x =
		kind === "total-score"
			? y
			: kind === "correct-score"
				? counts.correct
				: kind === "incorrect-score"
					? counts.incorrect
					: counts.unanswered;
	const percent =
		kind === "total-score" ? (y > 0 ? 100 : 0) : y === 0 ? 0 : (x / y) * 100;
	return format
		.split("{x}")
		.join(String(x))
		.split("{y}")
		.join(String(y))
		.split("{pct}")
		.join(formatPercent(percent));
}
