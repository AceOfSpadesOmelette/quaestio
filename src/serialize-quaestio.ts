/**
 * Update option [ ] / [x] markers and upsert answer-revealed in a quaestio fence body.
 * selectedByIndex uses 1-based option indexes.
 */

const OPTION_RE = /^(\[)([ xX]+)(\]\s+)(.+)$/;
const ANSWER_REVEALED_LINE_RE = /^answer-revealed:\s*.*$/i;
const HEADER_FLAG_RE =
	/^(number-of-correct-answers|correct-index|question-title|question-stem|correct-answer|explanation|answer-revealed)\s*:/i;

export function updateQuaestioBody(
	source: string,
	selectedByIndex: Record<number, boolean>,
	answerRevealed: boolean,
): string {
	const withMarkers = updateOptionMarkers(source, selectedByIndex);
	return upsertAnswerRevealed(withMarkers, answerRevealed);
}

/**
 * Update only the [ ] / [x] markers on option lines, in order.
 */
export function updateOptionMarkers(
	source: string,
	selectedByIndex: Record<number, boolean>,
): string {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	let optionNumber = 0;

	return lines
		.map((line) => {
			const m = line.match(OPTION_RE);
			if (!m) return line;
			optionNumber += 1;
			const selected = Boolean(selectedByIndex[optionNumber]);
			const marker = selected ? "x" : " ";
			return `${m[1]}${marker}${m[3]}${m[4]}`;
		})
		.join("\n");
}

/**
 * Replace existing answer-revealed line, or insert after header flags before options.
 */
export function upsertAnswerRevealed(
	source: string,
	answerRevealed: boolean,
): string {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const newLine = `answer-revealed: ${answerRevealed ? "true" : "false"}`;

	let found = false;
	const updated = lines.map((line) => {
		if (ANSWER_REVEALED_LINE_RE.test(line.trim())) {
			found = true;
			return newLine;
		}
		return line;
	});

	if (found) {
		return updated.join("\n");
	}

	// Insert after the last consecutive header flag before the first option line
	let insertAt = 0;
	let sawFlag = false;
	for (let i = 0; i < updated.length; i++) {
		const trimmed = (updated[i] ?? "").trim();
		if (trimmed === "") {
			if (sawFlag) {
				insertAt = i;
				break;
			}
			continue;
		}
		if (OPTION_RE.test(trimmed)) {
			insertAt = i;
			break;
		}
		if (HEADER_FLAG_RE.test(trimmed)) {
			sawFlag = true;
			insertAt = i + 1;
			continue;
		}
		// Non-flag content (e.g. multi-line stem body) — keep scanning
		if (sawFlag) {
			insertAt = i + 1;
		}
	}

	updated.splice(insertAt, 0, newLine);
	return updated.join("\n");
}
