/**
 * Update only the [ ] / [x] markers on option lines, in order.
 * selectedByIndex uses 1-based option indexes.
 * Flags, title, stem, Correct Answer, and Explanation are left unchanged.
 */
export function updateOptionMarkers(
	source: string,
	selectedByIndex: Record<number, boolean>,
): string {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	// Only classic option markers: [ ] or [x] (spaces/x inside brackets), then text
	const optionRe = /^(\[)([ xX]+)(\]\s+)(.+)$/;
	let optionNumber = 0;

	return lines
		.map((line) => {
			const m = line.match(optionRe);
			if (!m) return line;
			optionNumber += 1;
			const selected = Boolean(selectedByIndex[optionNumber]);
			const marker = selected ? "x" : " ";
			return `${m[1]}${marker}${m[3]}${m[4]}`;
		})
		.join("\n");
}
