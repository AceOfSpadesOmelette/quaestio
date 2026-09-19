import type { App, MarkdownPostProcessorContext } from "obsidian";
import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";
import { gradeSelection, parseQuaestio } from "./parse-quaestio";
import { persistSelections } from "./persist";
import type { GradeResult, QuaestioQuestion } from "./types";

/** Idle flush after the user stops interacting with a block. */
const IDLE_PERSIST_MS = 1500;

/** Active widgets keyed by their root element (same-el re-renders). */
const widgetRegistry = new WeakMap<HTMLElement, QuaestioWidget>();

/** All live widgets (for flush-all on leaf change / unload). */
const liveWidgets = new Set<QuaestioWidget>();

/**
 * Latest in-memory selection state per quaestio block, so remounts after our own
 * vault.write do not clobber clicks that happened during the write/remount window.
 */
const selectionCache = new Map<string, Record<number, boolean>>();

/**
 * Reveal / grade UI state per block. Survives Live Preview remounts that wipe
 * the widget instance (Show answer / Check / Reset would otherwise flash away).
 */
interface UiCache {
	revealed: boolean;
	graded: boolean;
	result: GradeResult | null;
}

const uiCache = new Map<string, UiCache>();

/**
 * Stable identity for a quaestio block across [ ]/[x] marker changes.
 * Uses sourcePath + source with option markers normalized.
 */
function blockKey(ctx: MarkdownPostProcessorContext, source: string): string {
	const normalized = source
		.replace(/\r\n/g, "\n")
		.replace(/^\[([ xX]+)\]/gm, "[ ]");
	return `${ctx.sourcePath}\0${normalized}`;
}

export function getQuaestioWidgetForRoot(el: HTMLElement): QuaestioWidget | undefined {
	return widgetRegistry.get(el);
}

/** Flush every live widget's selections to disk (leaf change / plugin unload). */
export async function flushAllQuaestioSelections(): Promise<void> {
	const widgets = [...liveWidgets];
	await Promise.all(widgets.map((w) => w.flushNow()));
}

/**
 * Document-capture pointerdown: run before CodeMirror so the first press
 * toggles the option. Does not call preventDefault (that would cancel click).
 */
export function onQuaestioPointerDown(ev: PointerEvent): void {
	// Primary pointer only (left mouse / main touch)
	if (ev.button !== 0) return;

	const target = ev.target;
	if (!(target instanceof Element)) return;

	const block = target.closest(".quaestio-block");
	if (!(block instanceof HTMLElement)) return;

	const widget = widgetRegistry.get(block);
	if (!widget || !widget.isLive()) return;

	const option = target.closest(".quaestio-option");
	if (option instanceof HTMLElement && block.contains(option)) {
		ev.stopPropagation();
		const index = Number(option.dataset.index ?? "0");
		if (Number.isFinite(index) && index >= 1) {
			widget.handleOption(index);
		}
		return;
	}

	const checkBtn = target.closest(".quaestio-btn-check");
	if (checkBtn instanceof HTMLElement && block.contains(checkBtn)) {
		ev.stopPropagation();
		widget.handleCheck();
		return;
	}

	const showBtn = target.closest(".quaestio-btn-show");
	if (showBtn instanceof HTMLElement && block.contains(showBtn)) {
		ev.stopPropagation();
		widget.handleToggleAnswer();
		return;
	}

	const resetBtn = target.closest(".quaestio-btn-reset");
	if (resetBtn instanceof HTMLElement && block.contains(resetBtn)) {
		ev.stopPropagation();
		widget.handleReset();
	}
}

/**
 * Bubble-phase click stop so leftover clicks do not place a cursor in LP
 * after a successful pointerdown toggle.
 */
export function onQuaestioClick(ev: MouseEvent): void {
	const target = ev.target;
	if (!(target instanceof Element)) return;
	if (!target.closest(".quaestio-block")) return;
	if (
		target.closest(".quaestio-option") ||
		target.closest(".quaestio-btn")
	) {
		ev.preventDefault();
		ev.stopPropagation();
	}
}

export function renderQuaestio(
	app: App,
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): void {
	const existingWidget = widgetRegistry.get(el);

	// Same element still has a live widget → update in place (no DOM destroy)
	if (existingWidget && existingWidget.isLive()) {
		const parsed = parseQuaestio(source);
		if (parsed.ok) {
			existingWidget.update(parsed.question);
		} else {
			existingWidget.markDestroyed();
			widgetRegistry.delete(el);
			el.empty();
			el.addClass("quaestio-block");
			el.createEl("pre", {
				cls: "quaestio-error",
				text: parsed.error,
			});
		}
		return;
	}

	// Element was cleared or first render — build fresh
	if (existingWidget) {
		existingWidget.markDestroyed();
		widgetRegistry.delete(el);
	}

	el.empty();
	el.addClass("quaestio-block");

	const parsed = parseQuaestio(source);
	if (!parsed.ok) {
		el.createEl("pre", {
			cls: "quaestio-error",
			text: parsed.error,
		});
		return;
	}

	const key = blockKey(ctx, source);
	const cached = selectionCache.get(key);
	if (cached) {
		for (const opt of parsed.question.options) {
			if (Object.prototype.hasOwnProperty.call(cached, opt.index)) {
				opt.selected = Boolean(cached[opt.index]);
			}
		}
	}

	const widget = new QuaestioWidget(app, el, ctx, parsed.question, key);
	widgetRegistry.set(el, widget);
	ctx.addChild(widget);
	void widget.mount();
}

async function renderMd(
	app: App,
	component: MarkdownRenderChild,
	markdown: string,
	el: HTMLElement,
	sourcePath: string,
): Promise<void> {
	el.empty();
	await MarkdownRenderer.render(app, markdown, el, sourcePath, component);
}

class QuaestioWidget extends MarkdownRenderChild {
	private revealed = false;
	private graded = false;
	private lastResult: GradeResult | null = null;
	private idleTimer: number | null = null;
	private optionEls: HTMLButtonElement[] = [];
	private resultEl: HTMLElement | null = null;
	private revealEl: HTMLElement | null = null;
	private showBtn: HTMLButtonElement | null = null;
	private multi = false;
	private destroyed = false;
	/** True when local selections may be ahead of the file. */
	private dirty = false;
	private persisting = false;

	constructor(
		private readonly app: App,
		readonly root: HTMLElement,
		private readonly ctx: MarkdownPostProcessorContext,
		private question: QuaestioQuestion,
		private readonly key: string,
	) {
		super(root);
	}

	onload(): void {
		liveWidgets.add(this);
	}

	onunload(): void {
		liveWidgets.delete(this);
		widgetRegistry.delete(this.root);
		// Fire-and-forget flush; Obsidian may unload before it completes
		void this.flushNow();
		this.markDestroyed();
	}

	/** Widget DOM is still attached and interactive. */
	isLive(): boolean {
		if (this.destroyed) return false;
		if (!this.root.isConnected) return false;
		const first = this.optionEls[0];
		if (!first) return false;
		return first.isConnected;
	}

	markDestroyed(): void {
		this.destroyed = true;
		this.clearIdleTimer();
		liveWidgets.delete(this);
	}

	/**
	 * Sync from a re-parsed question without destroying the DOM.
	 * When dirty, keep local selections (user may have clicked during persist).
	 */
	update(newQuestion: QuaestioQuestion): void {
		if (this.destroyed) return;

		const localSelected = this.dirty
			? Object.fromEntries(
					this.question.options.map((o) => [o.index, o.selected]),
				)
			: null;

		this.question = newQuestion;
		this.multi = newQuestion.numberOfCorrectAnswers > 1;

		if (localSelected) {
			for (const opt of this.question.options) {
				if (Object.prototype.hasOwnProperty.call(localSelected, opt.index)) {
					opt.selected = Boolean(localSelected[opt.index]);
				}
			}
		} else {
			// Overlay session cache so a flush-induced remount cannot roll back
			const cached = selectionCache.get(this.key);
			if (cached) {
				for (const opt of this.question.options) {
					if (Object.prototype.hasOwnProperty.call(cached, opt.index)) {
						opt.selected = Boolean(cached[opt.index]);
					}
				}
			}
		}

		this.updateOptionVisuals();

		if (this.revealed || this.graded) {
			this.applyFeedback();
		}

		this.cacheSelections();
	}

	async mount(): Promise<void> {
		if (this.destroyed) return;

		this.multi = this.question.numberOfCorrectAnswers > 1;

		// Build the full interactive shell synchronously first so clicks work
		// immediately — even while markdown labels are still rendering.
		const title = this.root.createEl("div", { cls: "quaestio-title" });
		const stem = this.root.createEl("div", { cls: "quaestio-stem" });

		const optionsWrap = this.root.createEl("div", {
			cls: "quaestio-options",
			attr: {
				role: this.multi ? "group" : "radiogroup",
				"aria-label": "Answer choices",
			},
		});

		for (const opt of this.question.options) {
			const btn = optionsWrap.createEl("button", {
				cls: "quaestio-option",
				attr: {
					type: "button",
					"data-index": String(opt.index),
					"aria-pressed": opt.selected ? "true" : "false",
				},
			});
			if (opt.selected) btn.addClass("is-selected");

			const marker = btn.createEl("span", { cls: "quaestio-option-marker" });
			if (opt.selected) marker.addClass("is-filled");

			// Plain-text fallback until markdown finishes
			const label = btn.createEl("span", { cls: "quaestio-option-label" });
			label.setText(opt.text);

			this.optionEls.push(btn);
		}

		const actions = this.root.createEl("div", { cls: "quaestio-actions" });

		actions.createEl("button", {
			cls: "quaestio-btn quaestio-btn-check",
			attr: { type: "button" },
			text: "Check",
		});

		this.showBtn = actions.createEl("button", {
			cls: "quaestio-btn quaestio-btn-show",
			attr: { type: "button" },
			text: "Show answer",
		});

		actions.createEl("button", {
			cls: "quaestio-btn quaestio-btn-reset",
			attr: { type: "button" },
			text: "Reset",
		});

		this.resultEl = this.root.createEl("div", {
			cls: "quaestio-result",
			attr: { hidden: "true" },
		});

		this.revealEl = this.root.createEl("div", {
			cls: "quaestio-reveal",
			attr: { hidden: "true" },
		});

		const caLabel = this.revealEl.createEl("div", {
			cls: "quaestio-section-label",
		});
		caLabel.setText("Correct Answer:");

		const caBody = this.revealEl.createEl("div", {
			cls: "quaestio-correct-answer",
		});

		const explLabel = this.revealEl.createEl("div", {
			cls: "quaestio-section-label",
		});
		explLabel.setText("Explanation:");

		const explBody = this.revealEl.createEl("div", {
			cls: "quaestio-explanation",
		});

		// Restore Show answer / Check / result UI before async markdown fill
		// so a remount does not flash the panel away.
		this.restoreUiState();

		// Fill markdown content asynchronously; options are already interactive
		await renderMd(
			this.app,
			this,
			this.question.title,
			title,
			this.ctx.sourcePath,
		);
		if (this.destroyed) return;

		await renderMd(
			this.app,
			this,
			this.question.stem,
			stem,
			this.ctx.sourcePath,
		);
		if (this.destroyed) return;

		for (let i = 0; i < this.question.options.length; i++) {
			if (this.destroyed) return;
			const opt = this.question.options[i];
			const btn = this.optionEls[i];
			if (!opt || !btn) continue;
			const label = btn.querySelector(".quaestio-option-label");
			if (!(label instanceof HTMLElement)) continue;
			await renderMd(this.app, this, opt.text, label, this.ctx.sourcePath);
		}
		if (this.destroyed) return;

		await renderMd(
			this.app,
			this,
			this.question.correctAnswerRaw || "(none)",
			caBody,
			this.ctx.sourcePath,
		);
		if (this.destroyed) return;

		await renderMd(
			this.app,
			this,
			this.question.explanation || "(none)",
			explBody,
			this.ctx.sourcePath,
		);

		// Re-apply after markdown fill (labels replaced but feedback classes stay on buttons)
		if (!this.destroyed && (this.revealed || this.graded)) {
			this.applyFeedback();
		}
	}

	/** Called from document-level capture pointerdown. */
	handleOption(index: number): void {
		if (this.destroyed) return;
		this.onOptionClick(index, this.multi);
	}

	handleCheck(): void {
		if (this.destroyed) return;
		this.onCheck();
	}

	handleToggleAnswer(): void {
		if (this.destroyed) return;
		this.onToggleAnswer();
	}

	handleReset(): void {
		if (this.destroyed) return;
		this.onReset();
	}

	/** Immediate flush (Check / unload / leaf change). */
	async flushNow(): Promise<void> {
		this.clearIdleTimer();
		if (this.destroyed && !this.dirty) return;
		if (!this.dirty) return;
		if (this.persisting) return;

		this.persisting = true;
		const map = this.selectedMap();
		this.cacheSelections();
		try {
			await persistSelections(this.app, this.ctx, this.root, map);
			if (!this.destroyed) {
				this.dirty = false;
			}
		} finally {
			this.persisting = false;
		}
	}

	private onOptionClick(index: number, multi: boolean): void {
		if (multi) {
			const opt = this.question.options.find((o) => o.index === index);
			if (opt) opt.selected = !opt.selected;
		} else {
			const current = this.question.options.find((o) => o.index === index);
			const wasSelected = current?.selected ?? false;
			for (const opt of this.question.options) {
				opt.selected = false;
			}
			if (current && !wasSelected) {
				current.selected = true;
			}
		}

		this.dirty = true;
		this.graded = false;
		this.lastResult = null;
		this.clearOptionFeedback();
		this.updateOptionVisuals();
		this.hideResult();
		this.cacheSelections();
		this.cacheUiState();
		// Do NOT persist on every click — schedule idle flush only
		this.scheduleIdlePersist();
	}

	private onCheck(): void {
		const result = gradeSelection(this.question);
		this.graded = true;
		this.lastResult = result;
		this.applyFeedback();
		this.showResult(result);
		if (!this.revealed) {
			this.setRevealed(true);
		} else {
			this.cacheUiState();
		}
		// User finished an attempt — safe to remount
		void this.flushNow();
	}

	private onToggleAnswer(): void {
		this.setRevealed(!this.revealed);
		if (this.revealed) {
			this.applyFeedback();
		} else if (!this.graded) {
			this.clearOptionFeedback();
			this.updateOptionVisuals();
		}
	}

	/** Clear selections, grading, and reveal panel back to a fresh quaestio. */
	private onReset(): void {
		for (const opt of this.question.options) {
			opt.selected = false;
		}
		this.graded = false;
		this.lastResult = null;
		this.dirty = true;
		this.clearOptionFeedback();
		this.updateOptionVisuals();
		this.hideResult();
		this.setRevealed(false);
		this.cacheSelections();
		this.cacheUiState();
		void this.flushNow();
	}

	private setRevealed(revealed: boolean): void {
		this.revealed = revealed;
		if (this.revealEl) {
			if (revealed) {
				this.revealEl.removeAttribute("hidden");
			} else {
				this.revealEl.setAttribute("hidden", "true");
			}
		}
		if (this.showBtn) {
			this.showBtn.setText(revealed ? "Hide answer" : "Show answer");
		}
		this.cacheUiState();
	}

	private updateOptionVisuals(): void {
		for (const btn of this.optionEls) {
			const index = Number(btn.dataset.index ?? "0");
			const opt = this.question.options.find((o) => o.index === index);
			if (!opt) continue;

			btn.toggleClass("is-selected", opt.selected);
			btn.setAttribute("aria-pressed", opt.selected ? "true" : "false");

			const marker = btn.querySelector(".quaestio-option-marker");
			if (marker instanceof HTMLElement) {
				marker.toggleClass("is-filled", opt.selected);
			}
		}
	}

	private clearOptionFeedback(): void {
		for (const btn of this.optionEls) {
			btn.removeClass("is-correct");
			btn.removeClass("is-incorrect");
			btn.removeClass("is-missed");
		}
	}

	private applyFeedback(): void {
		this.clearOptionFeedback();
		const correct = new Set(this.question.correctIndexes);
		const showKey = this.revealed || this.graded;

		for (const btn of this.optionEls) {
			const index = Number(btn.dataset.index ?? "0");
			const opt = this.question.options.find((o) => o.index === index);
			if (!opt) continue;

			const isCorrect = correct.has(index);
			if (opt.selected && isCorrect) {
				btn.addClass("is-correct");
			} else if (opt.selected && !isCorrect) {
				btn.addClass("is-incorrect");
			} else if (!opt.selected && isCorrect && showKey) {
				btn.addClass("is-missed");
			}
		}

		this.updateOptionVisuals();
	}

	private showResult(result: GradeResult): void {
		if (!this.resultEl) return;
		this.resultEl.removeAttribute("hidden");
		this.resultEl.removeClass("is-correct");
		this.resultEl.removeClass("is-incorrect");
		this.resultEl.removeClass("is-unanswered");

		if (result === "correct") {
			this.resultEl.addClass("is-correct");
			this.resultEl.setText("Correct");
		} else if (result === "incorrect") {
			this.resultEl.addClass("is-incorrect");
			this.resultEl.setText("Incorrect");
		} else {
			this.resultEl.addClass("is-unanswered");
			this.resultEl.setText("Unanswered");
		}
	}

	private hideResult(): void {
		if (!this.resultEl) return;
		this.resultEl.setAttribute("hidden", "true");
		this.resultEl.setText("");
	}

	private selectedMap(): Record<number, boolean> {
		const map: Record<number, boolean> = {};
		for (const opt of this.question.options) {
			map[opt.index] = opt.selected;
		}
		return map;
	}

	private cacheSelections(): void {
		selectionCache.set(this.key, this.selectedMap());
	}

	private cacheUiState(): void {
		uiCache.set(this.key, {
			revealed: this.revealed,
			graded: this.graded,
			result: this.lastResult,
		});
	}

	/** Apply cached Show answer / Check UI after a remount. */
	private restoreUiState(): void {
		const cached = uiCache.get(this.key);
		if (!cached) return;

		this.graded = cached.graded;
		this.lastResult = cached.result;

		if (cached.result && cached.graded) {
			this.showResult(cached.result);
		}

		this.setRevealed(cached.revealed);

		if (this.revealed || this.graded) {
			this.applyFeedback();
		}
	}

	private clearIdleTimer(): void {
		if (this.idleTimer !== null) {
			window.clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
	}

	private scheduleIdlePersist(): void {
		this.clearIdleTimer();
		this.idleTimer = window.setTimeout(() => {
			this.idleTimer = null;
			if (this.destroyed) return;
			void this.flushNow();
		}, IDLE_PERSIST_MS);
	}
}
