import type { App, MarkdownPostProcessorContext } from "obsidian";
import { TFile } from "obsidian";
import { updateQuaestioBody } from "./serialize-quaestio";

/**
 * Write option selections and answer-revealed back into the quaestio fence.
 * Skips vault.process when the body is already up to date (avoids remount flicker).
 */
export async function persistSelections(
	app: App,
	ctx: MarkdownPostProcessorContext,
	el: HTMLElement,
	selectedByIndex: Record<number, boolean>,
	answerRevealed: boolean,
): Promise<void> {
	const section = ctx.getSectionInfo(el);
	if (!section) return;

	const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!(file instanceof TFile)) return;

	await app.vault.process(file, (data) => {
		const lines = data.replace(/\r\n/g, "\n").split("\n");
		const start = section.lineStart;
		const end = section.lineEnd;

		if (start < 0 || end >= lines.length || start > end) {
			return data;
		}

		const bodyStart = start + 1;
		const bodyEnd = end;

		if (bodyStart >= bodyEnd) return data;

		const bodyLines = lines.slice(bodyStart, bodyEnd);
		const body = bodyLines.join("\n");
		const updatedBody = updateQuaestioBody(
			body,
			selectedByIndex,
			answerRevealed,
		);

		// No-op write → skip so Obsidian does not remount the widget
		if (updatedBody === body) {
			return data;
		}

		const updatedBodyLines = updatedBody.split("\n");

		const newLines = [
			...lines.slice(0, bodyStart),
			...updatedBodyLines,
			...lines.slice(bodyEnd),
		];

		const endsWithNewline = data.endsWith("\n") || data.endsWith("\r\n");
		const joined = newLines.join("\n");
		return endsWithNewline && !joined.endsWith("\n")
			? joined + "\n"
			: joined;
	});
}
