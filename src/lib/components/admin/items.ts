import KeyRound from '@lucide/svelte/icons/key-round';
import Trash from '@lucide/svelte/icons/trash';
import UserCheck from '@lucide/svelte/icons/user-check';
import UserX from '@lucide/svelte/icons/user-x';
import type { Component } from 'svelte';

/**
 * One item of a row's ⋯ (`ActionMenu`). A `pick` opens a dialog with the script (the
 * menu closes onto ⋯, then `onpick(id)`), and is the link `href` without it, the page
 * that shows the same form in place. A `post` submits `fields` to `action` at once.
 * `ruleBefore` sets a rule above it (the popover's; the row sheet's rows are ruled anyway).
 */
export type MenuItem = {
	id: string;
	label: string;
	icon?: Component;
	tone?: 'destructive';
	ruleBefore?: boolean;
} & (
	{ kind: 'pick'; href: string } | { kind: 'post'; action: string; fields: Record<string, string> }
);

/**
 * A user's ⋯ on Users: Set password…, then after a rule Disable or Enable. The admin's
 * own row has no Disable (nor Enable): the core refuses disabling oneself.
 */
export function userItems(user: { id: string; disabled: boolean }, actorId: string): MenuItem[] {
	const items: MenuItem[] = [
		{
			id: 'password',
			label: 'Set password…',
			icon: KeyRound,
			kind: 'pick',
			href: `?password=${encodeURIComponent(user.id)}`
		}
	];
	if (user.id === actorId) return items;
	items.push(
		user.disabled
			? {
					id: 'enable',
					label: 'Enable',
					icon: UserCheck,
					ruleBefore: true,
					kind: 'post',
					action: '?/enable',
					fields: { userId: user.id }
				}
			: {
					id: 'disable',
					label: 'Disable',
					icon: UserX,
					ruleBefore: true,
					kind: 'post',
					action: '?/disable',
					fields: { userId: user.id }
				}
	);
	return items;
}

/** A token's ⋯ on Account: Revoke… alone, in red, opening its confirm. */
export function tokenItems(token: { id: string }): MenuItem[] {
	return [
		{
			id: 'revoke',
			label: 'Revoke…',
			icon: Trash,
			tone: 'destructive',
			kind: 'pick',
			href: `?revoke=${encodeURIComponent(token.id)}`
		}
	];
}
