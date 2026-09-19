import { Plugin } from "obsidian";
import {
	flushAllQuaestioSelections,
	onQuaestioClick,
	onQuaestioPointerDown,
	renderQuaestio,
} from "./render-quaestio";

export default class QuaestioPlugin extends Plugin {
	async onload(): Promise<void> {
		// Capture-phase: beat CodeMirror so the first press toggles the option
		this.registerDomEvent(
			document,
			"pointerdown",
			onQuaestioPointerDown,
			{ capture: true },
		);
		// Bubble-phase: keep leftover clicks from placing the LP cursor
		this.registerDomEvent(document, "click", onQuaestioClick, { capture: false });

		this.registerMarkdownCodeBlockProcessor("quaestio", (source, el, ctx) => {
			renderQuaestio(this.app, source, el, ctx);
		});

		// Leaving a note / switching leaves: flush pending selections
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				void flushAllQuaestioSelections();
			}),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				void flushAllQuaestioSelections();
			}),
		);
	}

	async onunload(): Promise<void> {
		await flushAllQuaestioSelections();
	}
}
