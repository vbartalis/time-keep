import { goto, preloadData, pushState, replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { EntryFormData } from '#lib/components/entry/types.js';

/** The routes that show the entry form as a page (a template's in its template kind). */
const FORM_PAGES = new Set([
	'/(app)/entries/new',
	'/(app)/entries/[id]',
	'/(app)/templates/new',
	'/(app)/templates/[id]'
]);

/**
 * Opens the entry form at `href` (`/entries/new?…`, `/entries/<id>?…`, or a template's
 * `/templates/new?…`, `/templates/<id>?…`) over the
 * current screen, through shallow routing: the address shows the form's URL, so the
 * browser's Back closes it. Over a form already open (Copy) the new one takes its place
 * in history, so Back still returns to the screen. When the form cannot be loaded in
 * place, it is a plain navigation to its page. So is one opened over the form as a page:
 * two forms in one document would share their ids, and the dialog's Save would post the
 * page's form.
 */
export async function openForm(href: string): Promise<void> {
	if (FORM_PAGES.has(page.route.id ?? '')) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- an address from a resolved link
		await goto(href);
		return;
	}
	const result = await preloadData(href);
	if (result.type === 'loaded' && result.status === 200 && 'mode' in result.data) {
		const entryForm = { ...(result.data as EntryFormData), href };
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- an address from a resolved link
		if (page.state.entryForm) replaceState(href, { entryForm });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- as above
		else pushState(href, { entryForm });
		return;
	}
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- an address from a resolved link
	await goto(href);
}

/**
 * A click on a link to the entry form: opens it in place. A modified click (a new tab,
 * a new window) or another button than the primary one is left to the browser.
 */
export async function openInPlace(event: MouseEvent, href: string): Promise<void> {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	)
		return;
	event.preventDefault();
	await openForm(href);
}
