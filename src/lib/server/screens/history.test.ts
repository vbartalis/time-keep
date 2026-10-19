import { describe, expect, it } from 'vitest';
import type { HistoryBatch, HistoryChange } from '../core/index';
import {
	batchState,
	dayHeading,
	describeChange,
	historyPath,
	readChangeIds,
	type Names
} from './history';

const names: Names = {
	customers: new Map([['c1', 'Acme']]),
	projects: new Map([
		['p1', { name: 'Website', customerName: 'Acme' }],
		['p2', { name: 'App', customerName: 'Acme' }]
	]),
	activities: new Map([['a1', 'Design']]),
	locations: new Map([['l1', 'Office']])
};

const change = (over: Partial<HistoryChange>): HistoryChange => ({
	id: 'ch1',
	seq: 1,
	entity: 'entry',
	entityId: 'e1',
	op: 'update',
	before: null,
	after: null,
	reverts: null,
	undone: false,
	undoneBy: null,
	...over
});

const entry = (over: Record<string, unknown> = {}) => ({
	id: 'e1',
	userId: 'u',
	version: 1,
	createdAt: 1,
	updatedAt: 1,
	projectId: 'p1',
	activityId: null,
	locationId: null,
	startAt: Date.parse('2026-10-07T07:00:00Z'),
	startZone: 'Europe/Budapest',
	endAt: Date.parse('2026-10-07T09:30:00Z'),
	endZone: 'Europe/Budapest',
	reference: null,
	description: null,
	...over
});

describe('describeChange subjects and verbs', () => {
	it('names an entry with its span and project', () => {
		const line = describeChange(change({ op: 'create', after: entry() }), names);
		expect(line).toMatchObject({
			id: 'ch1',
			verb: 'Created',
			subject: 'Entry 2026-10-07 09:00–11:30, Acme › Website',
			fields: [],
			undone: false
		});
	});

	it('reads a running entry', () => {
		const line = describeChange(
			change({ op: 'delete', before: entry({ endAt: null, endZone: null }) }),
			names
		);
		expect(line.verb).toBe('Deleted');
		expect(line.subject).toBe('Entry 2026-10-07 09:00–running, Acme › Website');
	});

	it('names the other entities', () => {
		const sub = (entity: string, row: Record<string, unknown>) =>
			describeChange(change({ entity, op: 'create', after: row }), names).subject;
		expect(sub('customer', { name: 'Acme' })).toBe('Customer Acme');
		expect(sub('project', { name: 'Website', customerId: 'c1' })).toBe('Project Acme › Website');
		expect(sub('activity', { name: 'Design' })).toBe('Activity Design');
		expect(sub('location', { name: 'Office' })).toBe('Location Office');
		expect(sub('template', { name: 'Standup' })).toBe('Template Standup');
	});

	it('uses before when after is null and maps archive ops', () => {
		const archived = describeChange(
			change({ entity: 'customer', op: 'archive', before: { name: 'Acme' } }),
			names
		);
		expect(archived).toMatchObject({ verb: 'Archived', subject: 'Customer Acme' });
		expect(
			describeChange(
				change({ entity: 'customer', op: 'unarchive', after: { name: 'Acme' } }),
				names
			).verb
		).toBe('Unarchived');
	});

	it('shows (unknown) for a missing id', () => {
		const line = describeChange(
			change({ op: 'create', after: entry({ projectId: 'gone' }) }),
			names
		);
		expect(line.subject).toBe('Entry 2026-10-07 09:00–11:30, (unknown) › (unknown)');
	});

	it('carries undone', () => {
		expect(
			describeChange(change({ op: 'create', after: entry(), undone: true }), names).undone
		).toBe(true);
	});
});

describe('describeChange fields', () => {
	it('lists changed project and a cleared description', () => {
		const line = describeChange(
			change({
				before: entry({ description: 'old notes' }),
				after: entry({ projectId: 'p2', description: null, updatedAt: 9, version: 2 })
			}),
			names
		);
		expect(line.verb).toBe('Changed');
		expect(line.fields).toEqual([
			'Project: Acme › Website → Acme › App',
			'Description: old notes → none'
		]);
	});

	it('shows a zone-only start change with zones', () => {
		const at = Date.parse('2026-10-07T07:00:00Z');
		const line = describeChange(
			change({ before: entry(), after: entry({ startAt: at, startZone: 'Europe/London' }) }),
			names
		);
		expect(line.fields).toEqual([
			'Start: 2026-10-07 09:00 Europe/Budapest → 2026-10-07 08:00 Europe/London'
		]);
	});

	it('shows start and end instants without zones when zones match, running as such', () => {
		const line = describeChange(
			change({
				before: entry({ endAt: null, endZone: null }),
				after: entry({ startAt: Date.parse('2026-10-07T06:00:00Z') })
			}),
			names
		);
		expect(line.fields).toEqual([
			'Start: 2026-10-07 09:00 → 2026-10-07 08:00',
			'End: running → 2026-10-07 11:30'
		]);
	});

	it('reads an undone archive as Unarchived with no fields', () => {
		const line = describeChange(
			change({
				entity: 'customer',
				before: { name: 'Acme', archivedAt: 5 },
				after: { name: 'Acme', archivedAt: null, version: 3 }
			}),
			names
		);
		expect(line).toMatchObject({ verb: 'Unarchived', fields: [] });
		const arch = describeChange(
			change({
				entity: 'customer',
				before: { name: 'Acme', archivedAt: null },
				after: { name: 'Acme', archivedAt: 5 }
			}),
			names
		);
		expect(arch).toMatchObject({ verb: 'Archived', fields: [] });
	});

	it('reads a rename with archiving as Changed', () => {
		const line = describeChange(
			change({
				entity: 'project',
				before: { name: 'Website', customerId: 'c1', archivedAt: null, nameKey: 'website' },
				after: { name: 'Site', customerId: 'c1', archivedAt: 5, nameKey: 'site' }
			}),
			names
		);
		expect(line.verb).toBe('Changed');
		expect(line.fields).toEqual(['Name: Website → Site', 'Archived: no → yes']);
		expect(line.subject).toBe('Project Acme › Site');
	});

	it('cuts long sides at 80 characters', () => {
		const long = 'x'.repeat(100);
		const line = describeChange(
			change({ before: entry({ description: long }), after: entry({ description: 'short' }) }),
			names
		);
		expect(line.fields).toEqual([`Description: ${'x'.repeat(80)}… → short`]);
	});

	it('never shows bookkeeping keys', () => {
		const line = describeChange(
			change({
				entity: 'customer',
				before: {
					id: 'a',
					userId: 'u',
					version: 1,
					createdAt: 1,
					updatedAt: 1,
					nameKey: 'a',
					name: 'A'
				},
				after: {
					id: 'a',
					userId: 'u',
					version: 2,
					createdAt: 1,
					updatedAt: 2,
					nameKey: 'b',
					name: 'B'
				}
			}),
			names
		);
		expect(line.fields).toEqual(['Name: A → B']);
	});

	it('formats template duration and maps ids', () => {
		const base = { name: 'Standup', customerId: null, projectId: 'p1', durationMinutes: 90 };
		const line = describeChange(
			change({
				entity: 'template',
				before: { ...base, startTime: '09:00' },
				after: { ...base, projectId: 'p2', durationMinutes: null, startTime: '09:30' }
			}),
			names
		);
		expect(line.fields).toEqual([
			'Project: Acme › Website → Acme › App',
			'Start: 09:00 → 09:30',
			'Duration: 1:30 → none'
		]);
	});
});

describe('batchState', () => {
	const batch = (flags: boolean[]): HistoryBatch => ({
		id: 'b',
		actor: 'ui',
		label: 'x',
		createdAt: 0,
		undone: false,
		undoneBy: null,
		changes: flags.map((undone, i) => change({ id: `c${i}`, undone }))
	});
	it('is standing with none undone', () => {
		expect(batchState(batch([false, false, false]))).toEqual({
			state: 'standing',
			undone: 0,
			total: 3
		});
	});
	it('is partly with one undone', () => {
		expect(batchState(batch([true, false, false]))).toEqual({
			state: 'partly',
			undone: 1,
			total: 3
		});
	});
	it('is undone with all undone', () => {
		expect(batchState(batch([true, true, true]))).toEqual({ state: 'undone', undone: 3, total: 3 });
	});
});

describe('dayHeading', () => {
	it('gives the date and weekday in the zone', () => {
		expect(dayHeading(Date.parse('2026-10-19T10:00:00Z'), 'Europe/Budapest')).toBe(
			'2026-10-19, Monday'
		);
	});
});

describe('readChangeIds', () => {
	const form = (ids: string[]) => {
		const f = new FormData();
		for (const id of ids) f.append('changeId', id);
		return f;
	};
	it('requires at least one', () => {
		expect(readChangeIds(form([]))).toEqual({ ids: [], error: 'Select at least one change.' });
	});
	it('dedupes', () => {
		expect(readChangeIds(form(['a', 'b', 'a']))).toEqual({ ids: ['a', 'b'], error: null });
	});
	it('caps at 1000', () => {
		const ids = Array.from({ length: 1001 }, (_, i) => `i${i}`);
		expect(readChangeIds(form(ids)).error).toBe('Select at most 1000 changes.');
		expect(readChangeIds(form(ids.slice(0, 1000))).error).toBeNull();
	});
});

describe('historyPath', () => {
	it('is plain or carries an encoded cursor', () => {
		expect(historyPath(null)).toBe('/history');
		expect(historyPath('a b')).toBe('/history?before=a%20b');
	});
});
