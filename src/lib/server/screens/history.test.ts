import { describe, expect, it } from 'vitest';
import type { HistoryBatch, HistoryChange } from '../core/index';
import {
	batchState,
	dayHeading,
	describeChange,
	historyPath,
	readChangeIds,
	touchedLine,
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
			subject: 'entry 2026-10-07 09:00–11:30, Acme › Website',
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
		expect(line.subject).toBe('entry 2026-10-07 09:00–running, Acme › Website');
	});

	it('names the other entities', () => {
		const sub = (entity: string, row: Record<string, unknown>) =>
			describeChange(change({ entity, op: 'create', after: row }), names).subject;
		expect(sub('customer', { name: 'Acme' })).toBe('customer Acme');
		expect(sub('project', { name: 'Website', customerId: 'c1' })).toBe('project Acme › Website');
		expect(sub('activity', { name: 'Design' })).toBe('activity Design');
		expect(sub('location', { name: 'Office' })).toBe('location Office');
		expect(sub('template', { name: 'Standup' })).toBe('template Standup');
	});

	it('uses before when after is null and maps archive ops', () => {
		const archived = describeChange(
			change({ entity: 'customer', op: 'archive', before: { name: 'Acme' } }),
			names
		);
		expect(archived).toMatchObject({ verb: 'Archived', subject: 'customer Acme' });
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
		expect(line.subject).toBe('entry 2026-10-07 09:00–11:30, (unknown) › (unknown)');
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
			{ name: 'Project', old: 'Acme › Website', new: 'Acme › App', same: false },
			{ name: 'Description', old: 'old notes', new: null, same: false }
		]);
	});

	it('shows a zone-only start change with zones', () => {
		const at = Date.parse('2026-10-07T07:00:00Z');
		const line = describeChange(
			change({ before: entry(), after: entry({ startAt: at, startZone: 'Europe/London' }) }),
			names
		);
		expect(line.fields).toEqual([
			{
				name: 'Start',
				old: '2026-10-07 09:00 Europe/Budapest',
				new: '2026-10-07 08:00 Europe/London',
				same: false
			}
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
			{ name: 'Start', old: '2026-10-07 09:00', new: '2026-10-07 08:00', same: false },
			{ name: 'End', old: 'running', new: '2026-10-07 11:30', same: false }
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
		expect(line.fields).toEqual([
			{ name: 'Name', old: 'Website', new: 'Site', same: false },
			{ name: 'Archived', old: 'no', new: 'yes', same: false }
		]);
		expect(line.subject).toBe('project Acme › Site');
	});

	it('cuts long sides at 80 characters', () => {
		const long = 'x'.repeat(100);
		const line = describeChange(
			change({ before: entry({ description: long }), after: entry({ description: 'short' }) }),
			names
		);
		expect(line.fields).toEqual([
			{ name: 'Description', old: `${'x'.repeat(80)}…`, new: 'short', same: false }
		]);
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
		expect(line.fields).toEqual([{ name: 'Name', old: 'A', new: 'B', same: false }]);
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
			{ name: 'Project', old: 'Acme › Website', new: 'Acme › App', same: false },
			{ name: 'Start', old: '09:00', new: '09:30', same: false },
			{ name: 'Duration', old: '1:30', new: null, same: false }
		]);
	});
});

describe('describeChange field lines', () => {
	it('splits a field into its name, old and new sides', () => {
		const line = describeChange(
			change({
				before: entry({ description: 'Standup' }),
				after: entry({ description: 'Standup and planning' })
			}),
			names
		);
		expect(line.fields).toEqual([
			{ name: 'Description', old: 'Standup', new: 'Standup and planning', same: false }
		]);
	});

	it('reads a cleared side as null', () => {
		const line = describeChange(
			change({ before: entry({ reference: 'T-1' }), after: entry({ reference: null }) }),
			names
		);
		expect(line.fields).toEqual([{ name: 'Reference', old: 'T-1', new: null, same: false }]);
	});

	it('marks a field whose sides read the same', () => {
		const twins: Names = {
			...names,
			projects: new Map([...names.projects, ['p3', { name: 'Website', customerName: 'Acme' }]])
		};
		const line = describeChange(
			change({ before: entry(), after: entry({ projectId: 'p3' }) }),
			twins
		);
		expect(line.fields).toEqual([
			{ name: 'Project', old: 'Acme › Website', new: 'Acme › Website', same: true }
		]);
	});

	it('marks a blank turned null as the same, never none → none twice over', () => {
		const line = describeChange(
			change({ before: entry({ description: '' }), after: entry({ description: null }) }),
			names
		);
		expect(line.fields).toEqual([{ name: 'Description', old: null, new: null, same: true }]);
	});
});

describe('touchedLine', () => {
	const at = (iso: string) => Date.parse(iso);
	const batchOf = (changes: HistoryChange[]): HistoryBatch => ({
		id: 'b',
		actor: 'ui',
		label: 'x',
		createdAt: 0,
		undone: false,
		undoneBy: null,
		changes
	});
	const created = (id: string, row: Record<string, unknown>, entity = 'entry') =>
		change({ id: `ch-${id}`, entity, entityId: id, op: 'create', after: row });
	const on = (date: string, project = 'p1', id = date) =>
		created(id, {
			...entry({ id, projectId: project }),
			startAt: at(`${date}T08:00:00Z`),
			endAt: at(`${date}T09:00:00Z`)
		});
	const more: Names = {
		...names,
		projects: new Map([
			...names.projects,
			['p3', { name: 'Audit', customerName: 'Globex' }],
			['p4', { name: 'Support', customerName: 'Initech' }]
		])
	};

	it('names one entry by its weekday, date, times and project', () => {
		expect(touchedLine(batchOf([created('e1', entry())]), names)).toBe(
			'Wed 2026-10-07 09:00–11:30 · Acme › Website'
		);
	});

	it('reads an edited entry as it reads after the change', () => {
		const edit = change({
			before: entry({ description: 'old' }),
			after: entry({ projectId: 'p2', description: 'new' })
		});
		expect(touchedLine(batchOf([edit]), names)).toBe('Wed 2026-10-07 09:00–11:30 · Acme › App');
	});

	it('reads a deleted entry as it read before', () => {
		const gone = change({ op: 'delete', before: entry(), after: null });
		expect(touchedLine(batchOf([gone]), names)).toBe('Wed 2026-10-07 09:00–11:30 · Acme › Website');
	});

	it('reads a running entry', () => {
		const running = created('e1', entry({ endAt: null, endZone: null }));
		expect(touchedLine(batchOf([running]), names)).toBe(
			'Wed 2026-10-07 09:00–running · Acme › Website'
		);
	});

	it('names an entry in its own zones', () => {
		const tokyo = created('e1', entry({ startZone: 'Asia/Tokyo', endZone: 'Asia/Tokyo' }));
		expect(touchedLine(batchOf([tokyo]), names)).toBe(
			'Wed 2026-10-07 16:00–18:30 · Acme › Website'
		);
	});

	it('uses a project’s current name, renamed since', () => {
		const renamed: Names = {
			...names,
			projects: new Map([['p1', { name: 'Web shop', customerName: 'Acme' }]])
		};
		expect(touchedLine(batchOf([created('e1', entry())]), renamed)).toBe(
			'Wed 2026-10-07 09:00–11:30 · Acme › Web shop'
		);
	});

	it('reads an unknown project as such', () => {
		expect(touchedLine(batchOf([created('e1', entry({ projectId: 'gone' }))]), names)).toBe(
			'Wed 2026-10-07 09:00–11:30 · (unknown) › (unknown)'
		);
	});

	it('names several entries by their date range and distinct projects, newest first', () => {
		const line = touchedLine(
			batchOf([on('2026-10-13', 'p1'), on('2026-10-20', 'p2'), on('2026-10-15', 'p1')]),
			names
		);
		expect(line).toBe('2026-10-13 – 2026-10-20 · Acme › App, Acme › Website');
	});

	it('gives one date when the entries share it', () => {
		const line = touchedLine(
			batchOf([on('2026-10-20', 'p1', 'e1'), on('2026-10-20', 'p1', 'e2')]),
			names
		);
		expect(line).toBe('2026-10-20 · Acme › Website');
	});

	it('lists up to three projects, then how many more', () => {
		const line = touchedLine(
			batchOf([
				on('2026-10-13', 'p1'),
				on('2026-10-14', 'p2'),
				on('2026-10-15', 'p3'),
				on('2026-10-16', 'p4')
			]),
			more
		);
		expect(line).toBe(
			'2026-10-13 – 2026-10-16 · Initech › Support, Globex › Audit, Acme › App +1 more'
		);
	});

	it('counts an entry changed twice in one batch once', () => {
		const twice = [created('e1', entry()), change({ before: entry(), after: entry() })];
		expect(touchedLine(batchOf(twice), names)).toBe('Wed 2026-10-07 09:00–11:30 · Acme › Website');
	});

	it('names other records as their change lines do, capitalised', () => {
		const line = (entity: string, row: Record<string, unknown>) =>
			touchedLine(batchOf([created('r1', row, entity)]), names);
		expect(line('location', { name: 'Café' })).toBe('Location Café');
		expect(line('customer', { name: 'CompZ' })).toBe('Customer CompZ');
		expect(line('project', { name: 'Audit', customerId: 'c1' })).toBe('Project Acme › Audit');
		expect(line('activity', { name: 'Design' })).toBe('Activity Design');
		expect(line('template', { name: 'Standup' })).toBe('Template Standup');
	});

	it('counts several of one kind, and joins kinds', () => {
		const line = touchedLine(
			batchOf([
				created('l1', { name: 'Home' }, 'location'),
				created('l2', { name: 'Office' }, 'location'),
				created('l3', { name: 'Café' }, 'location'),
				created('a1', { name: 'Design' }, 'activity'),
				created('a2', { name: 'Build' }, 'activity'),
				created('t1', { name: 'Standup' }, 'template')
			]),
			names
		);
		expect(line).toBe('3 locations · 2 activities · Template Standup');
	});

	it('puts the entries first, then the other records', () => {
		const line = touchedLine(
			batchOf([created('l1', { name: 'Café' }, 'location'), created('e1', entry())]),
			names
		);
		expect(line).toBe('Wed 2026-10-07 09:00–11:30 · Acme › Website · Location Café');
	});

	it('is empty for a batch without changes', () => {
		expect(touchedLine(batchOf([]), names)).toBe('');
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
	it('gives the short weekday and the date in the zone', () => {
		expect(dayHeading(Date.parse('2026-10-19T10:00:00Z'), 'Europe/Budapest')).toBe(
			'Mon 2026-10-19'
		);
	});

	it('reads the day of the zone across its midnight', () => {
		// 22:30 UTC on Tuesday is 00:30 on Wednesday in Budapest (summer time).
		const at = Date.parse('2026-10-20T22:30:00Z');
		expect(dayHeading(at, 'Europe/Budapest')).toBe('Wed 2026-10-21');
		expect(dayHeading(at, 'UTC')).toBe('Tue 2026-10-20');
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
