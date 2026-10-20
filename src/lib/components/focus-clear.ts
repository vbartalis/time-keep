/**
 * Keyboard focus on the page lands clear of a band pinned over it (the undo strip, the
 * Entries bulk bar), not under it (WCAG 2.4.11).
 */

/**
 * A control in the screen's content, which a scroll can move: in `main`, not in a dialog,
 * and neither it nor an ancestor sticky or fixed (a pinned band itself, the bars, the "+").
 */
export function scrollsWithPage(el: Element): boolean {
	const main = el.closest('main');
	if (!main || el.closest('dialog')) return false;
	for (let at: Element | null = el; at && at !== main; at = at.parentElement) {
		const position = getComputedStyle(at).position;
		if (position === 'sticky' || position === 'fixed') return false;
	}
	return true;
}

/** Scrolls `target` to 8 px under `band`'s foot when the focus put it under the band. */
export function clearOf(band: Element, target: EventTarget | null) {
	if (!(target instanceof Element) || !scrollsWithPage(target)) return;
	const below = band.getBoundingClientRect().bottom + 8;
	const top = target.getBoundingClientRect().top;
	if (top < below) window.scrollBy(0, top - below);
}
