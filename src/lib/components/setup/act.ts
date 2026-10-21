import type { SubmitFunction } from '$app/forms';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { focusUndo } from '#lib/components/timesheet/live.js';
import type { Show } from '#lib/server/screens/setup.js';

/** `/setup` under a filter, with more of the address after it (`rename=<id>`, `new=…`). */
export function setupHref(show: Show, more: Record<string, string> = {}): string {
	const params = new URLSearchParams(show === 'active' ? more : { show, ...more });
	const query = params.toString();
	return query ? `${resolve('/(app)/setup')}?${query}` : resolve('/(app)/setup');
}

/** A form's action under the filter, so a refusal re-renders the same lists without the script. */
export const actionOf = (action: string, show: Show) =>
	show === 'active' ? `?/${action}` : `?/${action}&show=${show}`;

/** The ⋯ of a row, where a cancelled rename or a done action without a strip returns. */
export const menuButtonOf = (id: string) =>
	document.querySelector<HTMLElement>(`[data-menu-for="${CSS.escape(id)}"]`);

/**
 * `use:enhance` for Setup's posts. Done: `before` runs (the rename row or dialog closes),
 * the lists come back where they were scrolled and the focus goes to the strip's Undo
 * (without a strip, a rename to the same name, to `fallback`). Refused: the page renders
 * the action's failure (the field's message, the typed name kept).
 */
export const act =
	(opts: { before?: () => void; fallback?: () => HTMLElement | null } = {}): SubmitFunction =>
	({ formElement }) =>
	async ({ result, update }) => {
		// A refusal for a rename cancelled or a dialog closed meanwhile is not brought back.
		if (result.type === 'failure' && !formElement.isConnected) return;
		if (result.type !== 'redirect') return update();
		opts.before?.();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the action's own redirect
		await goto(result.location, { refreshAll: true, reset: false });
		await focusUndo(opts.fallback);
	};
