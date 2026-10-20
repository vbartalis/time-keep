import { describe, expect, it } from 'vitest';
import { barItems, currentItem, moreItems, ownsStrip, screenTitle, sidebarItems } from './shell';

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe('navigation lists', () => {
	it('lists the sidebar, with Users and Backup last for an admin', () => {
		const base = [
			'Today',
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
		expect(labels(barItems())).toEqual(['Today', 'Entries', 'Templates']);
		expect(labels(moreItems(false))).toEqual([
			'Setup',
			'Copy-out',
			'Reports',
			'History',
			'Account'
		]);
		expect(labels(moreItems(true))).toEqual([
			'Setup',
			'Copy-out',
			'Reports',
			'History',
			'Account',
			'Users',
			'Backup'
		]);
	});

	it('reaches every sidebar item from the bar or More', () => {
		const reachable = new Set([...barItems(), ...moreItems(true)].map((i) => i.route));
		for (const item of sidebarItems(true)) expect(reachable.has(item.route)).toBe(true);
	});
});

describe('screenTitle', () => {
	it.each([
		['/(app)', 'Today'],
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
	it('is true for the five strip screens only', () => {
		for (const id of [
			'/(app)',
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
