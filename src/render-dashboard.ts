import { MarkdownRenderChild, type MarkdownPostProcessorContext } from "obsidian";
import { parseDashboard, type DashboardSpec, type ScoreKind } from "./parse-dashboard";
import {
	checkAllInNote,
	checkAnsweredInNote,
	resetAllInNote,
	scoreNote,
	subscribeNoteChanges,
	toggleRevealAllInNote,
} from "./render-quaestio";
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

	constructor(
		root: HTMLElement,
		private readonly sourcePath: string,
		private readonly spec: DashboardSpec,
	) {
		super(root);
		this.hasScores = spec.items.some((item) => item.kind.endsWith("-score"));
	}

	onload(): void {
		this.build();
		this.refreshShowHide();
		this.refreshScores();
		this.unsubscribe = subscribeNoteChanges((path) => {
			if (path !== this.sourcePath) return;
			this.scheduleRefresh();
		});
	}

	onunload(): void {
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
			this.refreshScores();
		}
	}

	private scheduleRefresh(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.refreshShowHide();
			if (this.spec.liveUpdate) this.refreshScores();
		}, REFRESH_MS);
	}

	private build(): void {
		const root = this.containerEl;
		for (const item of this.spec.items) {
			if (item.kind.endsWith("-score")) {
				const kind = item.kind as ScoreKind;
				const format = "format" in item ? item.format : "";
				const el = root.createEl("div", { cls: "quaestio-dashboard-score" });
				this.scoreRows.push({ el, kind, format });
				continue;
			}

			const btn = root.createEl("button", {
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
			root.createEl("button", {
				cls: "quaestio-btn quaestio-dashboard-btn",
				attr: { type: "button", "data-action": "update" },
				text: "Update",
			});
		}
	}

	private counts(): ScoreCounts {
		const snap = scoreNote(this.sourcePath);
		return {
			correct: snap.correct,
			incorrect: snap.incorrect,
			unanswered: snap.unanswered,
			total: snap.total,
		};
	}

	private refreshScores(): void {
		const counts = this.counts();
		for (const row of this.scoreRows) {
			row.el.setText(formatScoreLine(row.format, row.kind, counts));
		}
	}

	private refreshShowHide(): void {
		if (!this.showBtn) return;
		const revealed = scoreNote(this.sourcePath).anyRevealed;
		this.showBtn.setText(revealed ? "Hide all answers" : "Show all answers");
	}
}

export function renderDashboard(
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

	const view = new DashboardView(el, ctx.sourcePath, parsed.spec);
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
