const FIELDS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * A screen's own key: unmodified, not held down, outside fields and while no dialog (or
 * popover marked `data-holds-keys`, the calendar's date picker) is open, and not already
 * taken by someone else.
 */
export function screenKey(e: KeyboardEvent): boolean {
	if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
		return false;
	const target = e.target instanceof Element ? e.target : null;
	if (target?.closest(FIELDS) || (target instanceof HTMLElement && target.isContentEditable))
		return false;
	return !document.querySelector('dialog[open], details[data-holds-keys][open]');
}
