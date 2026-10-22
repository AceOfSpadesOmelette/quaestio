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

export function formatScoreLine(
	format: string,
	kind: ScoreKind,
	counts: ScoreCounts,
	includeUnanswered = true,
): string {
	const x =
		kind === "correct-score"
			? counts.correct
			: kind === "incorrect-score"
				? counts.incorrect
				: counts.unanswered;
	const y =
		kind === "unanswered-score" || includeUnanswered
			? counts.total
			: counts.correct + counts.incorrect;
	const percent = y === 0 ? 0 : (x / y) * 100;
	const count = String(x);
	const total = String(y);
	return format
		.split("{count}")
		.join(count)
		.split("{total}")
		.join(total)
		.split("{x}")
		.join(count)
		.split("{y}")
		.join(total)
		.split("{pct}")
		.join(formatPercent(percent));
}
