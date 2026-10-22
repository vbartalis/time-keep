import { applyAction, type SubmitFunction } from '$app/forms';
import { goto } from '$app/navigation';
import { tick } from 'svelte';

/**
 * What Account's, Users' and Backup's dialogs share: where a closing leaves the focus,
 * leaving a dialog's no-script address, and a dialog form's post.
 */

/** The focus is nowhere a person put it: none, the page's body, or an element now gone. */
export function focusLost(at: Element | null, body: Element | null): boolean {
	return !at || at === body || !at.isConnected;
}

/** A row's ⋯ (`ActionMenu`, `data-menu-for`), where its menu's posts and dialogs return. */
export const rowMenuOf = (rowId: string) =>
	document.querySelector<HTMLElement>(`[data-menu-for="${CSS.escape(rowId)}"]`);

/**
 * Leaves a closed dialog: drops its no-script address (`?new=`, `?password=`, …) when the
 * page is at one, and forgets the post's answer (a refusal, a made token) when there is
 * one, so a reopen, a Back or a reload starts empty. `path` is the page's, resolved. The
 * focus stays where the closing put it (navigating and applying an action would reset it).
 */
export async function leaveDialog(
	path: string,
	{ hasAddress, hasAnswer }: { hasAddress: boolean; hasAnswer: boolean }
) {
	await tick();
	const at = document.activeElement;
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolved path
	if (hasAddress) await goto(path, { replace: true, reset: false });
	if (hasAnswer) await applyAction({ type: 'success', status: 200, location: path });
	if (at instanceof HTMLElement && !focusLost(at, document.body)) at.focus();
}

/**
 * A dialog form's post. A refusal for a dialog closed meanwhile is not brought back. Done,
 * `close` runs before the page updates (so the dialog is not held open by the answer),
 * then `done` (leave the address, place the focus).
 */
export const dialogSubmit =
	({ close, done }: { close?: () => void; done?: () => unknown } = {}): SubmitFunction =>
	({ formElement }) =>
	async ({ result, update }) => {
		if (result.type === 'failure' && !formElement.isConnected) return;
		const ok = result.type === 'success';
		if (ok) close?.();
		await update();
		if (ok) await done?.();
	};
