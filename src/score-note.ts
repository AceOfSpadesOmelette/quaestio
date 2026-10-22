import { gradeSelection, parseQuaestio } from "./parse-quaestio";
import type { GradeResult } from "./types";

export interface NoteScoreSnapshot {
	total: number;
	correct: number;
	incorrect: number;
	unanswered: number;
	anyRevealed: boolean;
}

export interface LiveGrade {
	key: string;
	grade: GradeResult;
	revealed: boolean;
}

/** Same identity widgets use, so a mounted block can replace its file grade. */
export function quaestioBlockKey(sourcePath: string, source: string): string {
	const normalized = source
		.replace(/\r\n/g, "\n")
		.replace(/\n+$/, "")
		.replace(/^\[([ xX]+)\]/gm, "[ ]")
		.replace(/^answer-revealed:\s*.*$/gim, "")
		.replace(/^answer-checked:\s*.*$/gim, "");
	return `${sourcePath}\0${normalized}`;
}

/** Fence bodies for ```quaestio, not ```quaestio-dashboard. */
export function extractQuaestioBodies(markdown: string): string[] {
	const bodies: string[] = [];
	const re = /```[ \t]*quaestio(?![-\w])[^\n]*\r?\n([\s\S]*?)```/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(markdown)) !== null) {
		if (match[1] != null) bodies.push(match[1]);
	}
	return bodies;
}

/**
 * Grade every quaestio fence in the note. A live widget with the same block key
 * replaces that fence's saved selection so clicks count before they are written.
 */
export function scoreMarkdown(
	sourcePath: string,
	markdown: string,
	live: LiveGrade[] = [],
): NoteScoreSnapshot {
	const pool = new Map<string, LiveGrade[]>();
	for (const item of live) {
		const list = pool.get(item.key) ?? [];
		list.push(item);
		pool.set(item.key, list);
	}

	let correct = 0;
	let incorrect = 0;
	let unanswered = 0;
	let anyRevealed = false;
	let total = 0;

	for (const body of extractQuaestioBodies(markdown)) {
		const parsed = parseQuaestio(body);
		if (!parsed.ok) continue;
		total += 1;
		const overlay = pool.get(quaestioBlockKey(sourcePath, body))?.shift();
		const grade = overlay ? overlay.grade : gradeSelection(parsed.question);
		if (grade === "correct") correct += 1;
		else if (grade === "incorrect") incorrect += 1;
		else unanswered += 1;
		if (overlay ? overlay.revealed : parsed.question.answerRevealed) {
			anyRevealed = true;
		}
	}

	return { total, correct, incorrect, unanswered, anyRevealed };
}
