import type { SubmitFunction } from '$app/forms';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { tick } from 'svelte';
import { rowRefusal } from './refusal.svelte';
import {
	filterQuery,
	readScope,
	scopeQuery,
	type Filter,
	type Preset
} from '#lib/filter/filter.js';
import { choiceQuery, readChoice } from '#lib/filter/output.js';

/** The fields a form (and the fields that name it with `form=`) holds as posted. */
function formParams(form: HTMLFormElement): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of new FormData(form)) {
		if (typeof value === 'string') params.append(key, value);
	}
	return params;
}

/** The filter a form (and the fields that name it with `form=`) holds as posted. */
export function formFilter(form: HTMLFormElement): Filter {
	const params = formParams(form);
	const range = (params.get('range') ?? 'this-month') as Preset | 'custom';
	const custom = range === 'custom';
	return {
		...readScope(params),
		range,
		from: custom ? (params.get('from') ?? '').trim() : '',
		to: custom ? (params.get('to') ?? '').trim() : '',
		q: (params.get('q') ?? '').trim()
	};
}

/**
 * Shows the table the form asks for, keeping the focus and the scroll. `replace` takes
 * the place of the current history entry (a search being typed) instead of adding one.
 */
export async function applyForm(form: HTMLFormElement, opts: { replace: boolean }): Promise<void> {
	if (new URL(form.action, location.href).pathname === resolve('/(app)/calendar')) {
		// The Calendar: its view and date kept, the scope as chosen, no range or search.
		const params = formParams(form);
		const kept = new URLSearchParams({
			view: params.get('view') ?? 'week',
			date: params.get('date') ?? ''
		});
		const scope = scopeQuery(readScope(params));
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the resolved route with its query
		await goto(`${resolve('/(app)/calendar')}?${kept}${scope === '' ? '' : `&${scope}`}`, {
			reset: false,
			replace: opts.replace
		});
		return;
	}
	const path = new URL(form.action, location.href).pathname;
	if (path === resolve('/(app)/copy-out') || path === resolve('/(app)/reports')) {
		// Copy-out and Reports: the filter, then the columns and options the form holds. A
		// form naming none of them sends none, so the kept choice applies.
		const { choice, named } = readChoice(formParams(form), undefined);
		const kept = named ? `&${choiceQuery(choice)}` : '';
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the resolved route with its query
		await goto(`${path}?${filterQuery(formFilter(form))}${kept}`, {
			reset: false,
			replace: opts.replace
		});
		return;
	}
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- the resolved route with its query
	await goto(`${resolve('/(app)/entries')}?${filterQuery(formFilter(form))}`, {
		reset: false,
		replace: opts.replace
	});
}

/**
 * Once a done change has drawn its strip, the focus goes to its Undo, the next thing
 * the user may want; without one, to `fallback`. The control acted from is gone.
 */
export async function focusUndo(fallback?: () => HTMLElement | null): Promise<void> {
	await tick();
	const undo = document.querySelector<HTMLElement>('[data-undo-strip] [data-undo]');
	(undo ?? fallback?.())?.focus();
}

/** `inPlace`, then `then` once the table is back. */
const backInPlace =
	(then?: () => Promise<void>): SubmitFunction =>
	({ formElement }) =>
	async ({ result, update }) => {
		if (result.type === 'failure') {
			const data = (result.data ?? {}) as { error?: string; conflict?: boolean; gone?: boolean };
			rowRefusal.error = data.error ?? 'This could not be done.';
			rowRefusal.reload = Boolean(data.conflict || data.gone);
			formElement.closest('details')?.removeAttribute('open');
			return;
		}
		if (result.type !== 'redirect') return update();
		rowRefusal.error = null;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
		await goto(result.location, { refreshAll: true, reset: false });
		await then?.();
	};

/**
 * `use:enhance` for a row's posts: back on the table where it was scrolled, with the
 * strip. A refusal (the entry changed or deleted elsewhere) is said on the table, its
 * menu closed, and the table is left as it was.
 */
export const inPlace: SubmitFunction = backInPlace();

/** A row's Delete: as `inPlace`, the focus then on the strip's Undo (the row is gone). */
export const removedInPlace: SubmitFunction = backInPlace(() => focusUndo());
