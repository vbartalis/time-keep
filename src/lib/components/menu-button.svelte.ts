/**
 * A row's ⋯ as a `<details>` popover with the menu-button pattern, shared by Setup's and
 * the account screens' menus: opened, the first item takes the focus; the arrows, Home
 * and End move among `[data-menu-item]`s; Escape closes it and returns to ⋯; Tab and a
 * click outside close it. Create it in a component's script; bind `details`, `summary`
 * and `list`, and hand the `<details>` `ontoggle` and the list `onkeydown`.
 */
export class MenuButton {
	details = $state<HTMLDetailsElement | null>(null);
	summary = $state<HTMLElement | null>(null);
	list = $state<HTMLElement | null>(null);
	/** Open, for `aria-expanded`. */
	open = $state(false);

	constructor() {
		$effect(() => () => document.removeEventListener('click', this.#outside, true));
	}

	#items = () => [...(this.list?.querySelectorAll<HTMLElement>('[data-menu-item]') ?? [])];

	#outside = (e: MouseEvent) => {
		const target = e.target instanceof Node ? e.target : null;
		if (target && this.details && !this.details.contains(target)) this.close(false);
	};

	/** Closes it, with the focus back on ⋯ when `focus`. */
	close = (focus: boolean) => {
		if (this.details) this.details.open = false;
		if (focus) this.summary?.focus();
	};

	ontoggle = () => {
		this.open = this.details?.open ?? false;
		if (this.open) {
			document.addEventListener('click', this.#outside, true);
			this.#items()[0]?.focus();
		} else {
			document.removeEventListener('click', this.#outside, true);
		}
	};

	onkeydown = (e: KeyboardEvent) => {
		const all = this.#items();
		const at = all.indexOf(document.activeElement as HTMLElement);
		const to = (i: number) => {
			e.preventDefault();
			all[(i + all.length) % all.length]?.focus();
		};
		if (e.key === 'ArrowDown') to(at + 1);
		else if (e.key === 'ArrowUp') to(at === -1 ? -1 : at - 1);
		else if (e.key === 'Home') to(0);
		else if (e.key === 'End') to(-1);
		else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			this.close(true);
		} else if (e.key === 'Tab') this.close(false);
	};
}

/** The ⋯ itself: 44 px, 36 px from `lg`. */
export const menuSummaryClass =
	'inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:size-9 [&::-webkit-details-marker]:hidden';
/** The 208 px popover under ⋯; right-aligned from `lg`. */
export const menuListClass =
	'absolute top-full left-0 z-20 mt-1 flex w-52 flex-col rounded-md border border-border bg-card p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)] lg:right-0 lg:left-auto';
/** A popover item: 44 px, 36 px from `lg`, a 14 px icon. */
export const menuItemClass =
	'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 text-left text-sm text-foreground outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent lg:h-9';
/** A row sheet item: a 48 px ruled row. */
export const sheetItemClass =
	'flex h-12 w-full cursor-pointer items-center gap-3 border-t border-border px-4 text-left text-base text-foreground outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent';
