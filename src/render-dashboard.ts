import { MarkdownRenderChild, TFile, type App, type MarkdownPostProcessorContext } from "obsidian";
import { parseDashboard, type DashboardSpec, type ScoreKind } from "./parse-dashboard";
import {
	checkAllInNote,
	checkAnsweredInNote,
	liveGradesForNote,
	resetAllInNote,
	subscribeNoteChanges,
	toggleRevealAllInNote,
} from "./render-quaestio";
import { scoreMarkdown, type NoteScoreSnapshot } from "./score-note";
import { formatScoreLine, type ScoreCounts } from "./score-format";

const REFRESH_MS = 80;

const dashboardRegistry = new WeakMap<HTMLElement, DashboardView>();

interface ScoreRow {
	el: HTMLElement;
	kind: ScoreKind;
	format: string;
}

class DashboardView extends MarkdownRenderChild {
	private unsubscribe: (() => void) | null = null;
	private timer: number | null = null;
	private readonly scoreRows: ScoreRow[] = [];
	private showBtn: HTMLElement | null = null;
	private readonly hasScores: boolean;
	private refreshGen = 0;
	private closed = false;
	private scoreRefreshPending = false;

	constructor(
		root: HTMLElement,
		private readonly app: App,
		private readonly sourcePath: string,
		private readonly spec: DashboardSpec,
	) {
		super(root);
		this.hasScores = spec.items.some((item) => item.kind.endsWith("-score"));
	}

	onload(): void {
		this.build();
		void this.refreshFromFile(true);
		this.unsubscribe = subscribeNoteChanges((path) => {
			if (path !== this.sourcePath) return;
			this.scheduleRefresh();
		});
	}

	onunload(): void {
		this.closed = true;
		this.refreshGen += 1;
		this.unsubscribe?.();
		this.unsubscribe = null;
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
		dashboardRegistry.delete(this.containerEl);
	}

	/** Called from document capture pointerdown. */
	onButton(btn: HTMLElement): void {
		const action = btn.dataset.action ?? "";
		if (action === "check-answered") {
			checkAnsweredInNote(this.sourcePath);
		} else if (action === "check-all") {
			checkAllInNote(this.sourcePath);
		} else if (action === "show-hide-all") {
			toggleRevealAllInNote(this.sourcePath);
		} else if (action === "reset-all") {
			resetAllInNote(this.sourcePath);
		} else if (action === "update") {
			void this.refreshFromFile(true);
		}
	}

	private scheduleRefresh(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			void this.refreshFromFile(this.spec.liveUpdate);
		}, REFRESH_MS);
	}

	private build(): void {
		const root = this.containerEl;
		let actions: HTMLElement | null = null;
		const endActions = () => {
			actions = null;
		};
		const actionRow = (): HTMLElement => {
			if (!actions) {
				actions = root.createDiv({ cls: "quaestio-dashboard-actions" });
			}
			return actions;
		};

		for (const item of this.spec.items) {
			if (item.kind.endsWith("-score")) {
				endActions();
				const kind = item.kind as ScoreKind;
				const format = "format" in item ? item.format : "";
				const el = root.createDiv( { cls: "quaestio-dashboard-score" });
				this.scoreRows.push({ el, kind, format });
				continue;
			}

			const btn = actionRow().createEl("button", {
				cls: "quaestio-btn quaestio-dashboard-btn",
				attr: { type: "button", "data-action": item.kind },
			});
			if (item.kind === "check-answered" || item.kind === "check-all") {
				btn.addClass("quaestio-btn-check");
			}
			if (item.kind === "check-answered") btn.setText("Check answered");
			else if (item.kind === "check-all") btn.setText("Check all");
			else if (item.kind === "reset-all") btn.setText("Reset all");
			else if (item.kind === "show-hide-all") {
				btn.setText("Show all answers");
				this.showBtn = btn;
			}
		}

		if (!this.spec.liveUpdate && this.hasScores) {
			actionRow().createEl("button", {
				cls: "quaestio-btn quaestio-dashboard-btn",
				attr: { type: "button", "data-action": "update" },
				text: "Update",
			});
		}
	}

	private async refreshFromFile(updateScores: boolean): Promise<void> {
		if (updateScores) this.scoreRefreshPending = true;
		const gen = ++this.refreshGen;
		const wantScores = this.scoreRefreshPending;
		const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
		let snap: NoteScoreSnapshot = {
			total: 0,
			correct: 0,
			incorrect: 0,
			unanswered: 0,
			anyRevealed: false,
		};
		if (file instanceof TFile) {
			const text = await this.app.vault.cachedRead(file);
			if (this.closed || gen !== this.refreshGen) return;
			snap = scoreMarkdown(this.sourcePath, text, liveGradesForNote(this.sourcePath));
		}
		if (this.closed || gen !== this.refreshGen) return;
		this.refreshShowHide(snap.anyRevealed);
		if (wantScores) {
			this.scoreRefreshPending = false;
			this.refreshScores(snap);
		}
	}

	private counts(snap: NoteScoreSnapshot): ScoreCounts {
		return {
			correct: snap.correct,
			incorrect: snap.incorrect,
			unanswered: snap.unanswered,
			total: snap.total,
		};
	}

	private refreshScores(snap: NoteScoreSnapshot): void {
		const counts = this.counts(snap);
		for (const row of this.scoreRows) {
			row.el.setText(
				formatScoreLine(row.format, row.kind, counts, this.spec.includeUnanswered),
			);
		}
	}

	private refreshShowHide(anyRevealed: boolean): void {
		if (!this.showBtn) return;
		this.showBtn.setText(anyRevealed ? "Hide all answers" : "Show all answers");
	}
}

export function renderDashboard(
	app: App,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): void {
	dashboardRegistry.get(el)?.unload();
	dashboardRegistry.delete(el);
	el.empty();
	el.addClass("quaestio-dashboard");

	const parsed = parseDashboard(source);
	if (!parsed.ok) {
		el.createEl("pre", { cls: "quaestio-error", text: parsed.error });
		return;
	}

	const view = new DashboardView(el, app, ctx.sourcePath, parsed.spec);
	dashboardRegistry.set(el, view);
	ctx.addChild(view);
}

export function onDashboardPointerDown(ev: PointerEvent): void {
	if (ev.button !== 0) return;
	const target = ev.target;
	if (!(target instanceof Element)) return;
	const block = target.closest(".quaestio-dashboard");
	if (!(block instanceof HTMLElement)) return;
	const view = dashboardRegistry.get(block);
	if (!view) return;
	const btn = target.closest("button");
	if (!(btn instanceof HTMLElement) || !block.contains(btn)) return;
	ev.stopPropagation();
	view.onButton(btn);
}

export function onDashboardClick(ev: MouseEvent): void {
	const target = ev.target;
	if (!(target instanceof Element)) return;
	const block = target.closest(".quaestio-dashboard");
	if (!(block instanceof HTMLElement)) return;
	const btn = target.closest("button");
	if (!(btn instanceof HTMLElement) || !block.contains(btn)) return;
	ev.preventDefault();
	ev.stopPropagation();
	// Pointer already ran the action. detail 0 is keyboard activation.
	if (ev.detail === 0) {
		dashboardRegistry.get(block)?.onButton(btn);
	}
}
