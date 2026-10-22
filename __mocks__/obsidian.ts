/** Minimal Obsidian API stubs for unit tests. */

export class Plugin {
	app: unknown;
	manifest: unknown;
	async loadData(): Promise<unknown> {
		return {};
	}
	async saveData(_data: unknown): Promise<void> {}
	addCommand(_cmd: unknown): void {}
	addSettingTab(_tab: unknown): void {}
	registerMarkdownCodeBlockProcessor(
		_lang: string,
		_handler: unknown,
	): void {}
	registerEvent(_ref: unknown): void {}
	registerDomEvent(
		_el: HTMLElement,
		_type: string,
		_callback: unknown,
	): void {}
}

export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	containerEl: HTMLElement;
	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement("div");
	}
	display(): void {}
	hide(): void {}
}

export class Setting {
	constructor(_containerEl: HTMLElement) {}
	setName(_name: string): this {
		return this;
	}
	setDesc(_desc: string): this {
		return this;
	}
	addText(_cb: (t: { setValue: (v: string) => unknown; setPlaceholder: (v: string) => unknown; onChange: (cb: (v: string) => void) => unknown }) => void): this {
		return this;
	}
	addToggle(_cb: (t: { setValue: (v: boolean) => unknown; onChange: (cb: (v: boolean) => void) => unknown }) => void): this {
		return this;
	}
	addDropdown(_cb: (d: { addOption: (v: string, d: string) => unknown; setValue: (v: string) => unknown; onChange: (cb: (v: string) => void) => unknown }) => void): this {
		return this;
	}
}

export class Notice {
	constructor(_message: string | DocumentFragment, _timeout?: number) {}
}

export class MarkdownRenderChild {
	containerEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}
	onload(): void {}
	onunload(): void {}
	load(): void {}
	unload(): void {}
}

export class TFile {
	path = "";
	basename = "";
	extension = "";
	name = "";
}

export class TAbstractFile {
	path = "";
	name = "";
}

export class Component {
	load(): void {}
	unload(): void {}
	addChild(_child: unknown): void {}
	removeChild(_child: unknown): void {}
}

export class Modal {
	app: unknown;
	contentEl: HTMLElement;
	constructor(app: unknown) {
		this.app = app;
		this.contentEl = document.createElement("div");
	}
	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

type ObsidianEl = HTMLElement & {
	empty(): void;
	addClass(cls: string): void;
	removeClass(cls: string): void;
	toggleClass(cls: string, force?: boolean): void;
	setText(text: string): void;
	createEl(
		tag: string,
		opts?: { cls?: string; text?: string; attr?: Record<string, string> },
	): HTMLElement;
};

function installDomHelpers(): void {
	const proto = HTMLElement.prototype as ObsidianEl;
	if (typeof proto.createEl === "function") return;
	proto.empty = function empty() {
		this.replaceChildren();
	};
	proto.addClass = function addClass(cls: string) {
		this.classList.add(cls);
	};
	proto.removeClass = function removeClass(cls: string) {
		this.classList.remove(cls);
	};
	proto.toggleClass = function toggleClass(cls: string, force?: boolean) {
		this.classList.toggle(cls, force);
	};
	proto.setText = function setText(text: string) {
		this.textContent = text;
	};
	proto.createEl = function createEl(tag, opts) {
		const el = document.createElement(tag);
		if (opts?.cls) el.className = opts.cls;
		if (opts?.text != null) el.textContent = opts.text;
		if (opts?.attr) {
			for (const [key, value] of Object.entries(opts.attr)) {
				el.setAttribute(key, value);
			}
		}
		this.appendChild(el);
		return el;
	};
}

installDomHelpers();

export const MarkdownRenderer = {
	async render(
		_app: unknown,
		markdown: string,
		el: HTMLElement,
	): Promise<void> {
		el.textContent = markdown;
	},
};

export const Platform = {
	isDesktop: true,
	isMobile: false,
	isPhone: false,
	isTablet: false,
	isDesktopApp: true,
	isMobileApp: false,
};
