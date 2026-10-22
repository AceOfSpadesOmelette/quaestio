export type DashboardAction = "check-answered" | "check-all" | "show-hide-all" | "reset-all";

export type ScoreKind = "correct-score" | "incorrect-score" | "unanswered-score" | "total-score";

export type DashboardItem =
	| { kind: DashboardAction }
	| { kind: ScoreKind; format: string };

export interface DashboardSpec {
	liveUpdate: boolean;
	items: DashboardItem[];
}

export type DashboardParseResult =
	| { ok: true; spec: DashboardSpec }
	| { ok: false; error: string };

const ACTIONS = new Set<DashboardAction>([
	"check-answered",
	"check-all",
	"show-hide-all",
	"reset-all",
]);

export const DEFAULT_SCORE_FORMATS: Record<ScoreKind, string> = {
	"correct-score": "Correct: {x} / {y}",
	"incorrect-score": "Incorrect: {x} / {y}",
	"unanswered-score": "Unanswered: {x} / {y}",
	"total-score": "Total: {y}",
};

function isScoreKind(value: string): value is ScoreKind {
	return Object.prototype.hasOwnProperty.call(DEFAULT_SCORE_FORMATS, value);
}

function isAction(value: string): value is DashboardAction {
	return ACTIONS.has(value as DashboardAction);
}

/**
 * Parse a quaestio-dashboard fence. Visible flags keep source order.
 * `live-update` is config only and does not produce a row.
 */
export function parseDashboard(source: string): DashboardParseResult {
	const seen = new Set<string>();
	const items: DashboardItem[] = [];
	let liveUpdate = true;

	const lines = source.replace(/\r\n/g, "\n").split("\n");
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		const colon = line.indexOf(":");
		const key = (colon >= 0 ? line.slice(0, colon) : line).trim().toLowerCase();
		const value = colon >= 0 ? line.slice(colon + 1).trim() : "";

		if (!key) {
			return { ok: false, error: "Unknown flag." };
		}
		if (seen.has(key)) {
			return { ok: false, error: `Duplicate flag: ${key}` };
		}
		seen.add(key);

		if (key === "live-update") {
			if (value !== "true" && value !== "false") {
				return { ok: false, error: "Invalid live-update. Use true or false." };
			}
			liveUpdate = value === "true";
			continue;
		}

		if (isAction(key)) {
			if (value) {
				return { ok: false, error: `Unexpected value for ${key}.` };
			}
			items.push({ kind: key });
			continue;
		}

		if (isScoreKind(key)) {
			items.push({
				kind: key,
				format: value || DEFAULT_SCORE_FORMATS[key],
			});
			continue;
		}

		return { ok: false, error: `Unknown flag: ${key}` };
	}

	return { ok: true, spec: { liveUpdate, items } };
}
