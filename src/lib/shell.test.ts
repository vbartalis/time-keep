import { describe, expect, it } from 'vitest';
import {
	barItems,
	currentItem,
	errorSentence,
	inMore,
	moreItems,
	ownsStrip,
	screenTitle,
	sidebarItems
} from './shell';

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe('navigation lists', () => {
	it('lists the sidebar, with Users and Backup last for an admin', () => {
		const base = [
			'Today',
			'Calendar',
			'Entries',
			'Copy-out',
			'Reports',
			'Templates',
			'Setup',
			'History',
			'Account'
		];
		expect(labels(sidebarItems(false))).toEqual(base);
		expect(labels(sidebarItems(true))).toEqual([...base, 'Users', 'Backup']);
	});

	it('lists the phone bar and More', () => {
		expect(labels(barItems())).toEqual(['Today', 'Calendar', 'Entries']);
		expect(barItems()[1].href).toBe('/calendar?view=day');
		const base = ['Templates', 'Setup', 'Copy-out', 'Reports', 'History', 'Account'];
		expect(labels(moreItems(false))).toEqual(base);
		expect(labels(moreItems(true))).toEqual([...base, 'Users', 'Backup']);
	});

	it('knows which routes More holds', () => {
		expect(inMore('/(app)/templates', false)).toBe(true);
		expect(inMore('/(app)/templates/[id]', false)).toBe(true);
		expect(inMore('/(app)/templates/new', false)).toBe(true);
		expect(inMore('/(app)/setup', false)).toBe(true);
		expect(inMore('/(app)/entries', false)).toBe(false);
		expect(inMore('/(app)', false)).toBe(false);
		expect(inMore(null, false)).toBe(false);
		expect(inMore('/(app)/admin/users', true)).toBe(true);
		expect(inMore('/(app)/admin/users', false)).toBe(false);
	});

	it('reaches every sidebar item from the bar or More', () => {
		const reachable = new Set([...barItems(), ...moreItems(true)].map((i) => i.route));
		for (const item of sidebarItems(true)) expect(reachable.has(item.route)).toBe(true);
	});
});

describe('screenTitle', () => {
	it.each([
		['/(app)', 'Today'],
		['/(app)/calendar', 'Calendar'],
		['/(app)/entries', 'Entries'],
		['/(app)/entries/new', 'New entry'],
		['/(app)/entries/[id]', 'Edit entry'],
		['/(app)/copy-out', 'Copy-out'],
		['/(app)/reports', 'Reports'],
		['/(app)/templates', 'Templates'],
		['/(app)/templates/new', 'New template'],
		['/(app)/templates/[id]', 'Edit template'],
		['/(app)/setup', 'Setup'],
		['/(app)/history', 'History'],
		['/(app)/account', 'Account'],
		['/(app)/admin/users', 'Users'],
		['/(app)/admin/backup', 'Backup'],
		['/(app)/undo', 'time-keep'],
		[null, 'time-keep']
	])('%s -> %s', (id, title) => {
		expect(screenTitle(id)).toBe(title);
	});
});

describe('currentItem', () => {
	it('marks an item itself', () => {
		expect(currentItem('/(app)', null)).toBe('/(app)');
		expect(currentItem('/(app)/admin/users', null)).toBe('/(app)/admin/users');
		expect(currentItem('/(app)/calendar', null)).toBe('/(app)/calendar');
	});

	it('marks the item owning a sub-screen', () => {
		expect(currentItem('/(app)/templates/new', null)).toBe('/(app)/templates');
		expect(currentItem('/(app)/templates/[id]', null)).toBe('/(app)/templates');
	});

	it('puts the entry edit screen under Entries from the list, else Today', () => {
		expect(currentItem('/(app)/entries/[id]', '/entries?from=2026-10-01')).toBe('/(app)/entries');
		expect(currentItem('/(app)/entries/[id]', '/')).toBe('/(app)');
		expect(currentItem('/(app)/entries/[id]', null)).toBe('/(app)');
	});

	it('puts the new entry screen under Entries from the list, else Today', () => {
		expect(currentItem('/(app)/entries/new', '/entries?from=2026-10-01')).toBe('/(app)/entries');
		expect(currentItem('/(app)/entries/new', '/templates')).toBe('/(app)');
		expect(currentItem('/(app)/entries/new', null)).toBe('/(app)');
	});

	it('marks nothing for a route outside the navigation', () => {
		expect(currentItem('/(app)/undo', null)).toBeNull();
		expect(currentItem(null, null)).toBeNull();
	});
});

describe('ownsStrip', () => {
	it('is true for the six strip screens only', () => {
		for (const id of [
			'/(app)',
			'/(app)/calendar',
			'/(app)/entries',
			'/(app)/setup',
			'/(app)/templates',
			'/(app)/history'
		]) {
			expect(ownsStrip(id)).toBe(true);
		}
		expect(ownsStrip('/(app)/reports')).toBe(false);
		expect(ownsStrip(null)).toBe(false);
	});
});

describe('errorSentence', () => {
	it('names admins only for the admin guard', () => {
		expect(errorSentence(403, 'Admins only')).toBe('Only an admin can open this page.');
	});

	it('does not blame the admin rule for another refusal', () => {
		expect(errorSentence(403, 'Cross-site POST form submissions are forbidden')).toBe(
			'The request was refused.'
		);
	});

	it('keeps the 404 and other sentences', () => {
		expect(errorSentence(404, 'Not Found')).toBe('There is nothing at this address.');
		expect(errorSentence(500, 'Internal Error')).toBe('Something went wrong on this page.');
	});
});
