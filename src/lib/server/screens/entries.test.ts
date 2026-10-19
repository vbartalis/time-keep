import { describe, expect, it } from 'vitest';
import { openCore, type EntryItem, type Result } from '../core/index';
import { user } from '../db/schema';
import { newId } from '../id';
import { createTestDb } from '../testing/db';
import {
	bulkUpdates,
	deleteLabel,
	editLabel,
	readBulk,
	readSearch,
	runBulk,
	searchInput,
	searchPath,
	selection,
	type BulkForm,
	type Search
} from './entries';

const ZONE = 'Europe/Budapest';
const NOW = Date.parse('2026-10-19T10:00:00Z');
const post = (fields: [string, string][]) => {
	const form = new FormData();
	for (const [key, value] of fields) form.append(key, value);
	return form;
};
const read = (query: string) => readSearch(new URLSearchParams(query), ZONE, NOW);

describe('readSearch', () => {
	it('defaults to the current month in the zone', () => {
		const { search, error } = read('');
		expect(error).toBeNull();
		expect(search).toMatchObject({ from: '2026-10-01', to: '2026-10-31', activity: 'any' });
	});

	it('leaves a blank bound unbound', () => {
		expect(read('from=&to=2026-10-05').search).toMatchObject({ from: '', to: '2026-10-05' });
	});

	it('refuses From after To and bad dates', () => {
		expect(read('from=2026-10-09&to=2026-10-01').error).toBe('From must not be after To.');
		expect(read('from=yesterday').error).toBe('Use dates like 2026-10-01.');
		expect(read('from=2026-02-30').error).toBe('Use dates like 2026-10-01.');
		// Not even a Date: month 13, day 32.
		expect(read('from=2026-13-01').error).toBe('Use dates like 2026-10-01.');
		expect(read('to=2026-10-32').error).toBe('Use dates like 2026-10-01.');
	});

	it('reads the pickers and all', () => {
		const { search } = read('from=&to=&activity=none&location=abc&all=1');
		expect(search).toMatchObject({ activity: 'none', location: 'abc', all: true });
		expect(read('').search.all).toBe(false);
	});
});

const month: Search = {
	from: '2026-10-01',
	to: '2026-10-31',
	customerId: '',
	projectId: '',
	activity: 'any',
	location: 'any',
	text: '',
	all: false
};

describe('searchInput', () => {
	it('asks for the days as instants in the zone', () => {
		expect(searchInput({ ...month, activity: 'none' }, ZONE)).toEqual({
			from: '2026-09-30T22:00:00.000Z',
			to: '2026-10-31T23:00:00.000Z',
			startedIn: true,
			order: 'asc',
			limit: 501,
			activityId: null
		});
	});

	it('leaves unset fields out and sends the set ones', () => {
		const input = searchInput({ ...month, from: '', to: '', projectId: 'p', text: 'x' }, ZONE);
		expect(input).toEqual({ startedIn: true, order: 'asc', limit: 501, projectId: 'p', text: 'x' });
		expect(input).not.toHaveProperty('from');
	});
});

describe('searchPath', () => {
	it('round-trips through readSearch without all', () => {
		const search = { ...month, activity: 'none', text: 'a b', all: true };
		const path = searchPath(search);
		expect(path.startsWith('/entries?')).toBe(true);
		expect(path).not.toContain('all=');
		expect(readSearch(new URL(path, 'http://x').searchParams, ZONE, NOW).search).toEqual({
			...search,
			all: false
		});
	});

	it('keeps a blank bound blank', () => {
		const path = searchPath({ ...month, from: '' });
		expect(read(path.slice('/entries?'.length)).search.from).toBe('');
	});
});

const keep: BulkForm = {
	projectId: '',
	activity: 'keep',
	location: 'keep',
	reference: '',
	clearReference: false,
	find: '',
	replace: ''
};
const item = (id: string, startAt: number, over: Partial<EntryItem> = {}): EntryItem =>
	({
		id,
		startAt,
		projectId: 'p1',
		activityId: null,
		locationId: null,
		reference: null,
		description: null,
		...over
	}) as EntryItem;
const currentOf = (...items: EntryItem[]) => new Map(items.map((i) => [i.id, i]));

describe('readBulk and selection', () => {
	it('keeps find and replace raw, and a whitespace find blank', () => {
		const bulk = readBulk(
			post([
				['find', ' a '],
				['replace', ' b'],
				['activity', 'none']
			])
		);
		expect(bulk).toMatchObject({ find: ' a ', replace: ' b', activity: 'none', location: 'keep' });
		expect(readBulk(post([['find', '  ']])).find).toBe('');
		expect(readBulk(post([['clearReference', 'on']])).clearReference).toBe(true);
	});

	it('pairs each id with its posted version, missing as blank', () => {
		const form = post([
			['id', 'a'],
			['id', 'b'],
			['version.a', '3']
		]);
		expect(selection(form)).toEqual([
			{ id: 'a', version: 3 },
			{ id: 'b', version: '' }
		]);
	});
});

describe('bulkUpdates', () => {
	const chosen = [{ id: 'a', version: 2 }];

	it('is empty when every field is kept', () => {
		expect(bulkUpdates(keep, chosen, currentOf(item('a', 1, { description: 'x' })))).toEqual([]);
	});

	it('replaces only where the text occurs', () => {
		const current = currentOf(
			item('a', 1, { description: 'teh job' }),
			item('b', 2, { description: 'fine' })
		);
		const both = [chosen[0], { id: 'b', version: 5 }];
		expect(bulkUpdates({ ...keep, find: 'teh', replace: 'the' }, both, current)).toEqual([
			{ id: 'a', expectedVersion: 2, description: 'the job' }
		]);
	});

	it('turns an emptied description into null', () => {
		const current = currentOf(item('a', 1, { description: 'x' }));
		expect(bulkUpdates({ ...keep, find: 'x' }, chosen, current)).toEqual([
			{ id: 'a', expectedVersion: 2, description: null }
		]);
	});

	it('treats a lone space as no find', () => {
		const bulk = readBulk(
			post([
				['find', ' '],
				['replace', 'z']
			])
		);
		expect(bulkUpdates(bulk, chosen, currentOf(item('a', 1, { description: 'a b' })))).toEqual([]);
	});

	it('leaves out a reference already set and clears on request', () => {
		const current = currentOf(item('a', 1, { reference: 'PO-1' }));
		expect(bulkUpdates({ ...keep, reference: ' PO-1 ' }, chosen, current)).toEqual([]);
		expect(bulkUpdates({ ...keep, reference: 'PO-2' }, chosen, current)).toEqual([
			{ id: 'a', expectedVersion: 2, reference: 'PO-2' }
		]);
		expect(bulkUpdates({ ...keep, clearReference: true }, chosen, current)).toEqual([
			{ id: 'a', expectedVersion: 2, reference: null }
		]);
	});

	it('changes project, activity and location only where they differ', () => {
		const current = currentOf(item('a', 1, { activityId: 'x' }), item('b', 2));
		const both = [chosen[0], { id: 'b', version: 1 }];
		expect(
			bulkUpdates({ ...keep, projectId: 'p1', activity: 'none', location: 'l' }, both, current)
		).toEqual([
			{ id: 'a', expectedVersion: 2, activityId: null, locationId: 'l' },
			{ id: 'b', expectedVersion: 1, locationId: 'l' }
		]);
	});

	it('orders oldest start first, unknown ids last', () => {
		const current = currentOf(item('a', 30), item('b', 10), item('c', 10));
		const posted = [
			{ id: 'zz', version: 1 },
			{ id: 'a', version: 1 },
			{ id: 'c', version: 1 },
			{ id: 'b', version: 1 }
		];
		const out = bulkUpdates({ ...keep, projectId: 'p2' }, posted, current);
		expect(out.map((u) => u.id)).toEqual(['b', 'c', 'a', 'zz']);
		expect(out[3]).toEqual({ id: 'zz', expectedVersion: 1, projectId: 'p2' });
	});
});

describe('labels', () => {
	it('count entries', () => {
		expect(editLabel(1)).toBe('Edit 1 entry');
		expect(editLabel(12)).toBe('Edit 12 entries');
		expect(deleteLabel(1)).toBe('Delete 1 entry');
		expect(deleteLabel(12)).toBe('Delete 12 entries');
	});
});

describe('runBulk', () => {
	const db = createTestDb();
	const uid = newId();
	db.insert(user)
		.values({ id: uid, username: 'u', passwordHash: 'x', createdAt: 1, updatedAt: 1 })
		.run();
	const core = openCore(db, uid, 'ui');
	const val = <T>(r: Result<T>): T => {
		if (!r.ok) throw new Error(r.error.message);
		return r.value;
	};
	const customer = val(core.customers.create({ name: 'C' }));
	const project = val(core.projects.create({ customerId: customer.id, name: 'P' }));
	const make = (start: string, end: string) =>
		val(core.entries.create({ projectId: project.id, start, end, timeZone: ZONE }));
	const a = make('2026-10-05T09:00', '2026-10-05T10:00');
	const b = make('2026-10-06T09:00', '2026-10-06T10:00');
	const fresh = (id: string) => val(core.entries.get({ id }));

	it('commits two updates as one labelled batch', () => {
		const { result, failedId } = runBulk(
			core,
			editLabel(2),
			[
				{ id: a.id, expectedVersion: a.version, reference: 'R' },
				{ id: b.id, expectedVersion: b.version, reference: 'R' }
			],
			'update'
		);
		expect(result.ok).toBe(true);
		expect(failedId).toBeNull();
		expect(fresh(a.id).reference).toBe('R');
		expect(fresh(b.id).reference).toBe('R');
		const batches = val(core.history.list());
		expect(batches[0].label).toBe('Edit 2 entries');
	});

	it('refuses the whole batch on a stale second and names it', () => {
		const a2 = fresh(a.id);
		const b2 = fresh(b.id);
		const { result, failedId } = runBulk(
			core,
			editLabel(2),
			[
				{ id: a2.id, expectedVersion: a2.version, reference: 'Z' },
				{ id: b2.id, expectedVersion: b2.version - 1, reference: 'Z' }
			],
			'update'
		);
		expect(result.ok).toBe(false);
		expect(failedId).toBe(b2.id);
		expect(fresh(a.id).reference).toBe('R');
		expect(fresh(b.id).reference).toBe('R');
	});

	it('names a throwing command too', () => {
		const a3 = fresh(a.id);
		const { result, failedId } = runBulk(
			core,
			editLabel(2),
			[
				{ id: a3.id, expectedVersion: a3.version, reference: 'Y' },
				{ id: 'nope', expectedVersion: 1, reference: 'Y' }
			],
			'update'
		);
		expect(result.ok).toBe(false);
		expect(failedId).toBe('nope');
		expect(fresh(a.id).reference).toBe('R');
	});

	it('deletes in one batch', () => {
		const a4 = fresh(a.id);
		const { result } = runBulk(
			core,
			deleteLabel(1),
			[{ id: a4.id, expectedVersion: a4.version }],
			'delete'
		);
		expect(result.ok).toBe(true);
		expect(core.entries.get({ id: a.id }).ok).toBe(false);
	});
});
