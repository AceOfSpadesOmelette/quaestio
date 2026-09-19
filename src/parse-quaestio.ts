import type { ParseResult, QuaestioOption, QuaestioQuestion } from "./types";

const OPTION_RE = /^\[([ xX]+)\]\s+(.+)$/;
const NUM_CORRECT_RE = /^number-of-correct-answers:\s*(\d+)\s*$/i;
const CORRECT_INDEX_RE = /^correct-index:\s*(.+)\s*$/i;
const QUESTION_TITLE_RE = /^question-title:\s*(.*)$/i;
const QUESTION_STEM_RE = /^question-stem:\s*(.*)$/i;
const CORRECT_ANSWER_FLAG_RE = /^correct-answer:\s*(.*)$/i;
const EXPLANATION_FLAG_RE = /^explanation:\s*(.*)$/i;

/** Any `key: value` line that looks like a flag (for unknown-flag errors). */
const ANY_FLAG_RE = /^([a-z0-9-]+)\s*:\s*(.*)$/i;

const KNOWN_FLAG_KEYS = new Set([
	"number-of-correct-answers",
	"correct-index",
	"question-title",
	"question-stem",
	"correct-answer",
	"explanation",
]);

type ContentFields = {
	questionTitle: string | null;
	questionStem: string | null;
	correctAnswer: string | null;
	explanation: string | null;
};

function parseCorrectIndexes(raw: string): number[] | null {
	const text = raw.trim();
	if (!text) return null;

	const inner = text.replace(/^\[/, "").replace(/\]$/, "").trim();
	if (!inner) return null;

	const parts = inner.split(/[,;\s]+/).filter((p) => p.length > 0);
	const indexes: number[] = [];
	for (const part of parts) {
		if (!/^\d+$/.test(part)) return null;
		indexes.push(Number(part));
	}
	return indexes.length > 0 ? indexes : null;
}

function parseOptionLine(line: string, index: number): QuaestioOption | null {
	const m = line.match(OPTION_RE);
	if (!m) return null;
	const marker = (m[1] ?? "").toLowerCase();
	const text = (m[2] ?? "").trimEnd();
	if (!text.trim()) return null;
	return {
		index,
		text,
		selected: marker.includes("x"),
	};
}

function isOptionLine(line: string): boolean {
	return parseOptionLine(line, 1) !== null;
}

function isKnownFlagLine(line: string): boolean {
	const trimmed = line.trim();
	return (
		NUM_CORRECT_RE.test(trimmed) ||
		CORRECT_INDEX_RE.test(trimmed) ||
		QUESTION_TITLE_RE.test(trimmed) ||
		QUESTION_STEM_RE.test(trimmed) ||
		CORRECT_ANSWER_FLAG_RE.test(trimmed) ||
		EXPLANATION_FLAG_RE.test(trimmed)
	);
}

function isAnyFlagLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed || isOptionLine(trimmed)) return false;
	return ANY_FLAG_RE.test(trimmed);
}

/**
 * Collect multi-line body after a flag with empty inline value.
 * Stops before the next known flag, unknown flag, or option line.
 * Leading blank lines after the flag are skipped; trailing blanks trimmed.
 */
function collectMultilineBody(
	lines: string[],
	start: number,
): { body: string; next: number } {
	let i = start;
	while (i < lines.length && (lines[i] ?? "").trim() === "") {
		i++;
	}

	const parts: string[] = [];
	while (i < lines.length) {
		const line = lines[i]!;
		const trimmed = line.trim();
		if (trimmed === "") {
			parts.push(line);
			i++;
			continue;
		}
		if (isKnownFlagLine(line) || isAnyFlagLine(line) || isOptionLine(line)) {
			break;
		}
		parts.push(line);
		i++;
	}

	while (parts.length > 0 && parts[parts.length - 1]!.trim() === "") {
		parts.pop();
	}

	return { body: parts.join("\n").trim(), next: i };
}

type FlagParseResult =
	| { ok: true; fields: ContentFields; numberOfCorrectAnswers: number | null; correctIndexes: number[] | null; next: number }
	| { ok: false; error: string };

/**
 * Parse one flag at lines[i]. Returns updated fields and next index.
 * Duplicate keys → error.
 */
function parseFlagAt(
	lines: string[],
	i: number,
	fields: ContentFields,
	numberOfCorrectAnswers: number | null,
	correctIndexes: number[] | null,
	allowed: Set<"machine" | "title" | "stem" | "correct-answer" | "explanation">,
): FlagParseResult {
	const trimmed = (lines[i] ?? "").trim();

	const numMatch = trimmed.match(NUM_CORRECT_RE);
	if (numMatch) {
		if (!allowed.has("machine")) {
			return { ok: false, error: "number-of-correct-answers must appear before options." };
		}
		if (numberOfCorrectAnswers !== null) {
			return { ok: false, error: "Duplicate flag: number-of-correct-answers" };
		}
		return {
			ok: true,
			fields,
			numberOfCorrectAnswers: Number(numMatch[1]),
			correctIndexes,
			next: i + 1,
		};
	}

	const idxMatch = trimmed.match(CORRECT_INDEX_RE);
	if (idxMatch) {
		if (!allowed.has("machine")) {
			return { ok: false, error: "correct-index must appear before options." };
		}
		if (correctIndexes !== null) {
			return { ok: false, error: "Duplicate flag: correct-index" };
		}
		const parsed = parseCorrectIndexes(idxMatch[1]!);
		if (parsed === null) {
			return {
				ok: false,
				error: "Invalid correct-index. Use e.g. [2, 4] or 2, 4 (1-based).",
			};
		}
		return {
			ok: true,
			fields,
			numberOfCorrectAnswers,
			correctIndexes: parsed,
			next: i + 1,
		};
	}

	const titleMatch = trimmed.match(QUESTION_TITLE_RE);
	if (titleMatch) {
		if (!allowed.has("title")) {
			return { ok: false, error: "question-title must appear before options." };
		}
		if (fields.questionTitle !== null) {
			return { ok: false, error: "Duplicate flag: question-title" };
		}
		const inline = (titleMatch[1] ?? "").trim();
		if (inline) {
			return {
				ok: true,
				fields: { ...fields, questionTitle: inline },
				numberOfCorrectAnswers,
				correctIndexes,
				next: i + 1,
			};
		}
		const { body, next } = collectMultilineBody(lines, i + 1);
		return {
			ok: true,
			fields: { ...fields, questionTitle: body },
			numberOfCorrectAnswers,
			correctIndexes,
			next,
		};
	}

	const stemMatch = trimmed.match(QUESTION_STEM_RE);
	if (stemMatch) {
		if (!allowed.has("stem")) {
			return { ok: false, error: "question-stem must appear before options." };
		}
		if (fields.questionStem !== null) {
			return { ok: false, error: "Duplicate flag: question-stem" };
		}
		const inline = (stemMatch[1] ?? "").trim();
		if (inline) {
			return {
				ok: true,
				fields: { ...fields, questionStem: inline },
				numberOfCorrectAnswers,
				correctIndexes,
				next: i + 1,
			};
		}
		const { body, next } = collectMultilineBody(lines, i + 1);
		return {
			ok: true,
			fields: { ...fields, questionStem: body },
			numberOfCorrectAnswers,
			correctIndexes,
			next,
		};
	}

	const caMatch = trimmed.match(CORRECT_ANSWER_FLAG_RE);
	if (caMatch) {
		if (!allowed.has("correct-answer")) {
			return { ok: false, error: "Unexpected correct-answer flag." };
		}
		if (fields.correctAnswer !== null) {
			return { ok: false, error: "Duplicate flag: correct-answer" };
		}
		const inline = (caMatch[1] ?? "").trim();
		if (inline) {
			return {
				ok: true,
				fields: { ...fields, correctAnswer: inline },
				numberOfCorrectAnswers,
				correctIndexes,
				next: i + 1,
			};
		}
		const { body, next } = collectMultilineBody(lines, i + 1);
		return {
			ok: true,
			fields: { ...fields, correctAnswer: body },
			numberOfCorrectAnswers,
			correctIndexes,
			next,
		};
	}

	const explMatch = trimmed.match(EXPLANATION_FLAG_RE);
	if (explMatch) {
		if (!allowed.has("explanation")) {
			return { ok: false, error: "Unexpected explanation flag." };
		}
		if (fields.explanation !== null) {
			return { ok: false, error: "Duplicate flag: explanation" };
		}
		const inline = (explMatch[1] ?? "").trim();
		if (inline) {
			return {
				ok: true,
				fields: { ...fields, explanation: inline },
				numberOfCorrectAnswers,
				correctIndexes,
				next: i + 1,
			};
		}
		const { body, next } = collectMultilineBody(lines, i + 1);
		return {
			ok: true,
			fields: { ...fields, explanation: body },
			numberOfCorrectAnswers,
			correctIndexes,
			next,
		};
	}

	const anyMatch = trimmed.match(ANY_FLAG_RE);
	if (anyMatch) {
		const key = (anyMatch[1] ?? "").toLowerCase();
		if (!KNOWN_FLAG_KEYS.has(key)) {
			return {
				ok: false,
				error: `Unknown flag: ${key}. Known flags: ${[...KNOWN_FLAG_KEYS].join(", ")}.`,
			};
		}
	}

	return {
		ok: false,
		error: `Unexpected line (expected a flag or option): ${trimmed}`,
	};
}

/**
 * Parse a quaestio fence body with required meta and content flags.
 */
export function parseQuaestio(source: string): ParseResult {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	while (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}
	if (lines.length === 0) {
		return { ok: false, error: "Empty quaestio block." };
	}

	let i = 0;
	let numberOfCorrectAnswers: number | null = null;
	let correctIndexes: number[] | null = null;
	let fields: ContentFields = {
		questionTitle: null,
		questionStem: null,
		correctAnswer: null,
		explanation: null,
	};

	const headerAllowed = new Set([
		"machine",
		"title",
		"stem",
		"correct-answer",
		"explanation",
	] as const);

	// Header: flags until first option line
	while (i < lines.length) {
		const trimmed = (lines[i] ?? "").trim();
		if (trimmed === "") {
			i++;
			continue;
		}
		if (isOptionLine(trimmed)) {
			break;
		}

		const result = parseFlagAt(
			lines,
			i,
			fields,
			numberOfCorrectAnswers,
			correctIndexes,
			headerAllowed as Set<"machine" | "title" | "stem" | "correct-answer" | "explanation">,
		);
		if (!result.ok) {
			return { ok: false, error: result.error };
		}
		fields = result.fields;
		numberOfCorrectAnswers = result.numberOfCorrectAnswers;
		correctIndexes = result.correctIndexes;
		i = result.next;
	}

	if (numberOfCorrectAnswers === null) {
		return {
			ok: false,
			error: "Missing required flag: number-of-correct-answers: N",
		};
	}
	if (correctIndexes === null) {
		return {
			ok: false,
			error: "Missing required flag: correct-index: [...]",
		};
	}
	if (fields.questionTitle === null || !fields.questionTitle.trim()) {
		return {
			ok: false,
			error: "Missing required flag: question-title: ...",
		};
	}
	if (fields.questionStem === null || !fields.questionStem.trim()) {
		return {
			ok: false,
			error: "Missing required flag: question-stem: ...",
		};
	}

	const questionTitle = fields.questionTitle.trim();
	const questionStem = fields.questionStem.trim();

	const options: QuaestioOption[] = [];
	while (i < lines.length) {
		const line = lines[i]!;
		const trimmed = line.trim();
		if (trimmed === "") {
			i++;
			// blank between options and trailing flags
			if (
				i < lines.length &&
				(CORRECT_ANSWER_FLAG_RE.test((lines[i] ?? "").trim()) ||
					EXPLANATION_FLAG_RE.test((lines[i] ?? "").trim()) ||
					isAnyFlagLine(lines[i]!))
			) {
				break;
			}
			continue;
		}
		if (
			CORRECT_ANSWER_FLAG_RE.test(trimmed) ||
			EXPLANATION_FLAG_RE.test(trimmed) ||
			isAnyFlagLine(line)
		) {
			break;
		}
		const opt = parseOptionLine(line, options.length + 1);
		if (!opt) {
			return {
				ok: false,
				error: `Invalid option line (expected "[ ] text"): ${line}`,
			};
		}
		options.push(opt);
		i++;
	}

	if (options.length < 2) {
		return { ok: false, error: "Need at least 2 options." };
	}

	while (i < lines.length && (lines[i] ?? "").trim() === "") {
		i++;
	}

	// Trailing: only correct-answer / explanation (if not already set)
	const trailingAllowed = new Set([
		"correct-answer",
		"explanation",
	] as const);

	while (i < lines.length) {
		const trimmed = (lines[i] ?? "").trim();
		if (trimmed === "") {
			i++;
			continue;
		}

		const result = parseFlagAt(
			lines,
			i,
			fields,
			numberOfCorrectAnswers,
			correctIndexes,
			trailingAllowed as Set<"machine" | "title" | "stem" | "correct-answer" | "explanation">,
		);
		if (!result.ok) {
			return { ok: false, error: result.error };
		}
		fields = result.fields;
		i = result.next;
	}

	const validationError = validateFlags(
		numberOfCorrectAnswers,
		correctIndexes,
		options.length,
	);
	if (validationError) {
		return { ok: false, error: validationError };
	}

	const question: QuaestioQuestion = {
		numberOfCorrectAnswers,
		correctIndexes: [...correctIndexes].sort((a, b) => a - b),
		title: questionTitle,
		stem: questionStem,
		options,
		correctAnswerRaw: (fields.correctAnswer ?? "").trim(),
		explanation: (fields.explanation ?? "").trim(),
	};

	return { ok: true, question };
}

export function validateFlags(
	n: number,
	indexes: number[],
	optionCount: number,
): string | null {
	if (n < 1) {
		return "number-of-correct-answers must be at least 1.";
	}
	if (n > optionCount) {
		return `number-of-correct-answers (${n}) is greater than the number of options (${optionCount}).`;
	}
	if (n !== indexes.length) {
		return `number-of-correct-answers (${n}) does not match correct-index length (${indexes.length}).`;
	}
	const seen = new Set<number>();
	for (const idx of indexes) {
		if (idx < 1 || idx > optionCount) {
			return `correct-index value ${idx} is out of range (1–${optionCount}).`;
		}
		if (seen.has(idx)) {
			return `Duplicate correct-index value: ${idx}.`;
		}
		seen.add(idx);
	}
	return null;
}

/** Grade by comparing selected option indexes to correctIndexes. */
export function gradeSelection(
	question: QuaestioQuestion,
): "correct" | "incorrect" | "unanswered" {
	const selected = question.options
		.filter((o) => o.selected)
		.map((o) => o.index);
	if (selected.length === 0) return "unanswered";

	const correct = new Set(question.correctIndexes);
	if (selected.length !== correct.size) return "incorrect";
	for (const idx of selected) {
		if (!correct.has(idx)) return "incorrect";
	}
	return "correct";
}
