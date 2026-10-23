import { Plugin } from "obsidian";
import { onDashboardClick, onDashboardPointerDown, renderDashboard } from "./render-dashboard";
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
		this.registerDomEvent(document, "pointerdown", onDashboardPointerDown, { capture: true });
		this.registerDomEvent(document, "click", onDashboardClick, { capture: false });

		this.registerMarkdownCodeBlockProcessor("quaestio", (source, el, ctx) => {
			renderQuaestio(this.app, source, el, ctx);
		});
		this.registerMarkdownCodeBlockProcessor("quaestio-dashboard", (source, el, ctx) => {
			renderDashboard(this.app, source, el, ctx);
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

	onunload(): void {
		void flushAllQuaestioSelections();
	}
}
